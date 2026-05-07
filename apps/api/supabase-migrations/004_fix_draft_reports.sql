-- ============================================================
-- Migration 004: Fix draft_reports for reliable persistence
-- ============================================================

-- 1. Drop the FK constraint on template_id so we can use
--    built-in fallback templates (non-UUID template_id values)
DO $$
DECLARE
  _con TEXT;
BEGIN
  SELECT conname INTO _con
  FROM pg_constraint
  WHERE conrelid = 'draft_reports'::regclass
    AND contype = 'f'
    AND conname ILIKE '%template%';
  IF _con IS NOT NULL THEN
    EXECUTE 'ALTER TABLE draft_reports DROP CONSTRAINT ' || quote_ident(_con);
  END IF;
END
$$;

-- 2. Allow template_id to be NULL (fallback template case)
ALTER TABLE draft_reports ALTER COLUMN template_id DROP NOT NULL;

-- 3. Add auto-update trigger for updated_at if not already present
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'draft_reports'::regclass
      AND tgname   = 'draft_reports_updated_at'
  ) THEN
    CREATE TRIGGER draft_reports_updated_at
      BEFORE UPDATE ON draft_reports
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END
$$;

-- 4. Index for fast latest-draft-per-episode lookup
CREATE INDEX IF NOT EXISTS idx_drafts_episode_updated
  ON draft_reports(episode_id, updated_at DESC);
