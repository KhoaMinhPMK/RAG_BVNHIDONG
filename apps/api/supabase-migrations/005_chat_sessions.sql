-- ============================================================
-- Migration 005: Chat Session History
-- Lưu trữ lịch sử hội thoại AI theo session
-- ============================================================

-- ── chat_sessions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_sessions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL,   -- FK to auth.users (omitted for portability)
  episode_id      TEXT,                   -- optional binding to episode
  title           TEXT        NOT NULL DEFAULT 'Phiên mới',
  status          TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'archived')),
  forked_from_id  UUID        REFERENCES chat_sessions(id) ON DELETE SET NULL,
  forked_at_idx   INTEGER,
  context_summary TEXT,                   -- LLM-generated summary of trimmed turns
  token_count     INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user
  ON chat_sessions(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_episode
  ON chat_sessions(episode_id) WHERE episode_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_status
  ON chat_sessions(user_id, status, updated_at DESC);

-- ── chat_messages ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID        NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  idx              INTEGER     NOT NULL,   -- 0-based order within session
  role             TEXT        NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content          TEXT        NOT NULL,
  citations        JSONB,                  -- CitationAnchor[] — assistant only
  retrieved_chunks JSONB,                  -- raw RAG chunks — audit
  model_id         TEXT,
  policy_version   TEXT,
  latency_ms       INTEGER,
  token_count      INTEGER     NOT NULL DEFAULT 0,
  is_summarized    BOOLEAN     NOT NULL DEFAULT FALSE,
  feedback         SMALLINT    CHECK (feedback IN (-1, 0, 1)),
  feedback_note    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, idx)
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session
  ON chat_messages(session_id, idx);

CREATE INDEX IF NOT EXISTS idx_chat_messages_fts
  ON chat_messages USING gin(to_tsvector('simple', content));

-- auto-update updated_at on sessions
CREATE OR REPLACE FUNCTION update_chat_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_sessions
  SET updated_at = NOW()
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_session_on_message
  AFTER INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION update_chat_session_timestamp();
