-- ============================================================
-- Migration 006: Report Versioning + Concurrent Edit Lock
-- Immutable version history cho draft_reports
-- ============================================================

-- ── Extend draft_reports with versioning columns ───────────
ALTER TABLE draft_reports
  ADD COLUMN IF NOT EXISTS session_id     UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS current_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS superseded_by   UUID    REFERENCES draft_reports(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_draft_reports_session
  ON draft_reports(session_id) WHERE session_id IS NOT NULL;

-- ── report_versions: immutable audit trail ─────────────────
CREATE TABLE IF NOT EXISTS report_versions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id          UUID        NOT NULL REFERENCES draft_reports(id) ON DELETE CASCADE,
  version           INTEGER     NOT NULL,
  blocks            JSONB       NOT NULL DEFAULT '[]',   -- RenderableBlock[]
  citation_snapshot JSONB       NOT NULL DEFAULT '[]',   -- CitationAnchor[] frozen at this version
  model_id          TEXT,
  policy_version    TEXT,
  action            TEXT        NOT NULL
                    CHECK (action IN (
                      'ai_generated', 'user_edited', 'submitted_for_review',
                      'approved', 'rejected', 'superseded', 'forked'
                    )),
  action_by         UUID,       -- FK to auth.users
  action_note       TEXT,
  session_id        UUID        REFERENCES chat_sessions(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (draft_id, version)
);

-- Prevent modifications to existing versions (immutable log)
CREATE OR REPLACE RULE no_update_report_versions AS
  ON UPDATE TO report_versions DO INSTEAD NOTHING;

CREATE OR REPLACE RULE no_delete_report_versions AS
  ON DELETE TO report_versions DO INSTEAD NOTHING;

CREATE INDEX IF NOT EXISTS idx_report_versions_draft
  ON report_versions(draft_id, version DESC);

CREATE INDEX IF NOT EXISTS idx_report_versions_action_by
  ON report_versions(action_by, created_at DESC);

-- ── report_locks: concurrent edit detection ────────────────
CREATE TABLE IF NOT EXISTS report_locks (
  draft_id    UUID        PRIMARY KEY REFERENCES draft_reports(id) ON DELETE CASCADE,
  locked_by   UUID        NOT NULL,   -- FK to auth.users
  locked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes')
);

CREATE INDEX IF NOT EXISTS idx_report_locks_expires
  ON report_locks(expires_at);

-- ── RPC: acquire lock (upsert + respect existing) ──────────
CREATE OR REPLACE FUNCTION acquire_report_lock(
  p_draft_id UUID,
  p_user_id  UUID
) RETURNS JSONB AS $$
DECLARE
  existing report_locks%ROWTYPE;
BEGIN
  SELECT * INTO existing FROM report_locks WHERE draft_id = p_draft_id;

  -- No lock or expired lock → acquire
  IF existing.draft_id IS NULL OR existing.expires_at < NOW() THEN
    INSERT INTO report_locks (draft_id, locked_by, locked_at, expires_at)
    VALUES (p_draft_id, p_user_id, NOW(), NOW() + INTERVAL '10 minutes')
    ON CONFLICT (draft_id) DO UPDATE
      SET locked_by = p_user_id,
          locked_at = NOW(),
          expires_at = NOW() + INTERVAL '10 minutes';
    RETURN jsonb_build_object('acquired', true, 'locked_by', p_user_id);
  END IF;

  -- Same user → renew
  IF existing.locked_by = p_user_id THEN
    UPDATE report_locks SET expires_at = NOW() + INTERVAL '10 minutes'
    WHERE draft_id = p_draft_id;
    RETURN jsonb_build_object('acquired', true, 'locked_by', p_user_id);
  END IF;

  -- Someone else holds it
  RETURN jsonb_build_object(
    'acquired', false,
    'locked_by', existing.locked_by,
    'expires_at', existing.expires_at
  );
END;
$$ LANGUAGE plpgsql;
