-- WebRAG Database Schema
-- Version: 0.1.0
-- Description: Database schema for RAG medical system

-- Enable pgvector extension for vector embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- Documents Table (Knowledge Base)
-- ============================================================================
CREATE TABLE IF NOT EXISTS documents (
  document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  version TEXT NOT NULL,
  effective_date DATE NOT NULL,
  expiry_date DATE,
  status TEXT NOT NULL CHECK (status IN ('active', 'superseded', 'retired')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  approved_by TEXT,
  owner TEXT,
  scope TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_effective_date ON documents(effective_date);
CREATE INDEX idx_documents_metadata ON documents USING GIN(metadata);

-- ============================================================================
-- Document Chunks (Vector Embeddings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS document_chunks (
  chunk_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI ada-002 dimension
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chunks_document ON document_chunks(document_id);
CREATE INDEX idx_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops);

-- ============================================================================
-- Document Versions (Version History)
-- ============================================================================
CREATE TABLE IF NOT EXISTS document_versions (
  version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_versions_document ON document_versions(document_id);

-- ============================================================================
-- Users / Profiles (RBAC)
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('clinician', 'radiologist', 'researcher', 'admin')),
  department TEXT,
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_email ON profiles(email);

-- ============================================================================
-- Episodes (Patient Context)
-- ============================================================================
CREATE TABLE IF NOT EXISTS episodes (
  episode_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_ref TEXT NOT NULL,
  age TEXT,
  gender TEXT,
  admission_date DATE,
  chief_complaint TEXT,
  vital_signs JSONB,
  lab_results JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_episodes_patient_ref ON episodes(patient_ref);
CREATE INDEX idx_episodes_admission_date ON episodes(admission_date);

-- ============================================================================
-- Report Templates
-- ============================================================================
CREATE TABLE IF NOT EXISTS report_templates (
  template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  intended_use TEXT,
  approved_by TEXT,
  effective_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'draft', 'retired')),
  schema JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_templates_status ON report_templates(status);

-- ============================================================================
-- Draft Reports
-- ============================================================================
CREATE TABLE IF NOT EXISTS draft_reports (
  draft_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES episodes(episode_id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES report_templates(template_id),
  fields JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'under_review', 'edited', 'approved', 'rejected', 'archived')),
  model_version TEXT,
  created_by UUID REFERENCES profiles(user_id),
  approved_by UUID REFERENCES profiles(user_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_drafts_episode ON draft_reports(episode_id);
CREATE INDEX idx_drafts_status ON draft_reports(status);
CREATE INDEX idx_drafts_created_by ON draft_reports(created_by);

-- ============================================================================
-- Query Sessions (RAG History)
-- ============================================================================
CREATE TABLE IF NOT EXISTS query_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(user_id),
  query TEXT NOT NULL,
  answer TEXT,
  citations JSONB,
  model_version TEXT,
  status TEXT CHECK (status IN ('success', 'insufficient_evidence', 'out_of_scope')),
  episode_id UUID REFERENCES episodes(episode_id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON query_sessions(user_id);
CREATE INDEX idx_sessions_episode ON query_sessions(episode_id);
CREATE INDEX idx_sessions_created_at ON query_sessions(created_at);

-- ============================================================================
-- Feedback Logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS feedback_logs (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(user_id),
  episode_id UUID REFERENCES episodes(episode_id),
  draft_id UUID REFERENCES draft_reports(draft_id),
  action TEXT NOT NULL CHECK (action IN ('accept', 'edit', 'reject', 'report_error')),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feedback_user ON feedback_logs(user_id);
CREATE INDEX idx_feedback_episode ON feedback_logs(episode_id);
CREATE INDEX idx_feedback_draft ON feedback_logs(draft_id);

-- ============================================================================
-- Audit Logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES profiles(user_id),
  user_role TEXT,
  action TEXT NOT NULL,
  episode_id UUID REFERENCES episodes(episode_id),
  draft_id UUID REFERENCES draft_reports(draft_id),
  details JSONB
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_episode ON audit_logs(episode_id);
CREATE INDEX idx_audit_action ON audit_logs(action);

-- ============================================================================
-- Document Sourcing Queue (Async Agent)
-- ============================================================================
CREATE TABLE IF NOT EXISTS document_sourcing_queue (
  queue_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_query TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  results JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_queue_status ON document_sourcing_queue(status);

-- ============================================================================
-- Document Candidates (Pending Approval)
-- ============================================================================
CREATE TABLE IF NOT EXISTS document_candidates (
  candidate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  source TEXT,
  url TEXT,
  content TEXT,
  quality_score FLOAT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES profiles(user_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX idx_candidates_status ON document_candidates(status);

-- ============================================================================
-- Functions: Updated timestamp trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_episodes_updated_at BEFORE UPDATE ON episodes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON report_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_drafts_updated_at BEFORE UPDATE ON draft_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Row Level Security (RLS) - TODO: Enable after auth setup
-- ============================================================================
-- ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE draft_reports ENABLE ROW LEVEL SECURITY;
-- ... (policies will be added later)
