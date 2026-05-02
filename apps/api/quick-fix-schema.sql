-- Quick fix for documents table schema
-- Run this in Supabase SQL Editor

-- Add missing columns
ALTER TABLE documents ADD COLUMN IF NOT EXISTS checksum TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS access_level TEXT DEFAULT 'clinician';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS owner TEXT DEFAULT 'System';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS age_group TEXT DEFAULT 'pediatric';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'vi';

-- Disable RLS temporarily for ingestion
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE chunks DISABLE ROW LEVEL SECURITY;

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'documents'
ORDER BY ordinal_position;
