-- Migration 002: Episodes Enhancement
-- Date: 2026-05-02
-- Description: Add status, findings, and created_by fields to episodes table

-- ============================================================================
-- Update Episodes Table
-- ============================================================================

-- Add new columns to episodes table
ALTER TABLE episodes
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending_detection'
  CHECK (status IN ('pending_detection', 'pending_explain', 'pending_draft', 'pending_approval', 'completed', 'archived')),
ADD COLUMN IF NOT EXISTS findings TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(user_id);

-- Add index for status filtering
CREATE INDEX IF NOT EXISTS idx_episodes_status ON episodes(status);
CREATE INDEX IF NOT EXISTS idx_episodes_created_by ON episodes(created_by);

-- ============================================================================
-- Images Table (X-ray image metadata)
-- ============================================================================

CREATE TABLE IF NOT EXISTS images (
  image_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES episodes(episode_id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_images_episode ON images(episode_id);

-- ============================================================================
-- Detection Results Table (PCXR detection results)
-- ============================================================================

CREATE TABLE IF NOT EXISTS detection_results (
  result_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES episodes(episode_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  results JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_detection_episode ON detection_results(episode_id);
CREATE INDEX idx_detection_status ON detection_results(status);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE images IS 'Stores X-ray image metadata and Supabase Storage paths';
COMMENT ON TABLE detection_results IS 'Stores PCXR detection job status and results';
COMMENT ON COLUMN episodes.status IS 'Episode workflow status: pending_detection -> pending_explain -> pending_draft -> pending_approval -> completed';
COMMENT ON COLUMN episodes.findings IS 'Array of detected findings (e.g., ["Consolidation", "Pleural effusion"])';
