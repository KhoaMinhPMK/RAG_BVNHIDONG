-- ============================================================
-- Migration 003: AI Run Persistence
-- Lưu trữ mọi kết quả AI: brief, explain, draft, chat, query
-- ============================================================

-- ── ai_runs: one row per AI invocation ─────────────────────
CREATE TABLE IF NOT EXISTS ai_runs (
  run_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id    UUID        NOT NULL,   -- FK to episodes intentionally omitted for portability
  run_type      TEXT        NOT NULL CHECK (run_type IN ('brief', 'explain', 'draft', 'chat', 'query')),
  status        TEXT        NOT NULL DEFAULT 'streaming'
                            CHECK (status IN ('streaming', 'completed', 'error', 'aborted')),

  -- Structured output (RenderableBlock[])
  blocks        JSONB       NOT NULL DEFAULT '[]',
  -- Raw text fallback
  raw_content   TEXT        NOT NULL DEFAULT '',
  -- Citations (CitationAnchor[])
  citations     JSONB       NOT NULL DEFAULT '[]',

  -- Model provenance
  provider      TEXT,
  model         TEXT,
  usage         JSONB,        -- { completion_tokens, reasoning_tokens, total_tokens }

  -- Error state
  error_msg     TEXT,

  -- Context at time of run
  finding_ids   TEXT[]      DEFAULT '{}',
  draft_ref     UUID,        -- set when run produces a draft_reports row

  -- Audit
  created_by    UUID,       -- FK to profiles intentionally omitted for portability
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_runs_episode_type
  ON ai_runs(episode_id, run_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_runs_status
  ON ai_runs(status, created_at DESC);

-- ── ai_run_blocks: incremental block storage ───────────────
-- Each SSE block is appended as it arrives so partial runs
-- are recoverable if the stream is interrupted mid-way.
CREATE TABLE IF NOT EXISTS ai_run_blocks (
  id         BIGSERIAL    PRIMARY KEY,
  run_id     UUID         NOT NULL REFERENCES ai_runs(run_id) ON DELETE CASCADE,
  seq        INTEGER      NOT NULL,
  block      JSONB        NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_run_blocks_run
  ON ai_run_blocks(run_id, seq);

-- ── RPC: atomically append a block ────────────────────────
CREATE OR REPLACE FUNCTION ai_run_append_block(
  p_run_id UUID,
  p_block  JSONB
) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  SELECT COALESCE(MAX(seq) + 1, 0)
    INTO v_seq
    FROM ai_run_blocks
   WHERE run_id = p_run_id;

  INSERT INTO ai_run_blocks(run_id, seq, block)
  VALUES (p_run_id, v_seq, p_block);

  -- Keep ai_runs.blocks in sync for fast full-read queries
  UPDATE ai_runs
     SET blocks = blocks || jsonb_build_array(p_block)
   WHERE run_id = p_run_id;
END;
$$;

-- ── Alter draft_reports: approval + basic e-signature ─────
ALTER TABLE draft_reports
  ADD COLUMN IF NOT EXISTS run_id         UUID,
  ADD COLUMN IF NOT EXISTS approved_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_note  TEXT,
  ADD COLUMN IF NOT EXISTS signature_data JSONB;

-- approved_by may already exist; wrap in DO block to skip if present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'draft_reports'
      AND column_name  = 'approved_by'
  ) THEN
    ALTER TABLE draft_reports ADD COLUMN approved_by UUID;
  END IF;
END
$$;

-- Fix schema inconsistency: code writes 'fields' JSONB, ensure NOT NULL default
ALTER TABLE draft_reports
  ALTER COLUMN fields SET DEFAULT '{}';

-- ── query_results: persists /api/query outputs ────────────
CREATE TABLE IF NOT EXISTS query_results (
  query_id     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id   UUID,       -- soft ref to episodes (no FK for portability)
  run_id       UUID        REFERENCES ai_runs(run_id) ON DELETE SET NULL,
  query_text   TEXT        NOT NULL,
  answer       TEXT        NOT NULL DEFAULT '',
  sources      JSONB       NOT NULL DEFAULT '[]',
  created_by   UUID,       -- soft ref to profiles
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_query_results_episode
  ON query_results(episode_id, created_at DESC);
