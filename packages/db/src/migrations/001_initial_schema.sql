-- Migration 001: Initial schema for WebRAG
-- Tạo tables: documents, chunks, users, query_logs, templates, feedback
-- Theo yêu cầu RAG-D-05, RAG-D-06, RAG-D-07

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ============= DOCUMENTS TABLE =============
-- Metadata của tài liệu nguồn
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  version TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('WHO', 'BTS', 'BYT', 'PubMed', 'Internal', 'Other')),
  effective_date DATE NOT NULL,
  expiry_date DATE,
  owner TEXT NOT NULL, -- Chủ sở hữu chuyên môn
  approved_by TEXT,
  age_group TEXT, -- 'pediatric', 'adult', 'all'
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'superseded', 'retired')) DEFAULT 'draft',
  language TEXT NOT NULL CHECK (language IN ('vi', 'en')) DEFAULT 'vi',
  access_level TEXT NOT NULL CHECK (access_level IN ('public', 'clinician', 'radiologist', 'researcher', 'admin')) DEFAULT 'clinician',
  file_url TEXT,
  checksum TEXT, -- SHA256 hash của file
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE(title, version),
  CHECK (expiry_date IS NULL OR expiry_date > effective_date)
);

-- Index cho search và filter
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_source ON documents(source);
CREATE INDEX idx_documents_effective_date ON documents(effective_date);
CREATE INDEX idx_documents_access_level ON documents(access_level);

-- ============= CHUNKS TABLE =============
-- Vector embeddings của document chunks
CREATE TABLE chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(768), -- nomic-embed-text dimension
  metadata JSONB, -- {page, section, heading, tokens}
  effective_date DATE NOT NULL,
  expiry_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE(document_id, chunk_index),
  CHECK (chunk_index >= 0),
  CHECK (expiry_date IS NULL OR expiry_date > effective_date)
);

-- HNSW index cho vector similarity search (nhanh hơn IVFFlat)
-- Theo architect review: dùng HNSW thay vì IVFFlat
CREATE INDEX idx_chunks_embedding ON chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Index cho metadata filter
CREATE INDEX idx_chunks_document_id ON chunks(document_id);
CREATE INDEX idx_chunks_effective_date ON chunks(effective_date);
CREATE INDEX idx_chunks_metadata ON chunks USING gin(metadata);

-- ============= USERS TABLE =============
-- Sync với Supabase Auth
CREATE TABLE users (
  id UUID PRIMARY KEY, -- Sync với auth.users.id
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('clinician', 'radiologist', 'researcher', 'admin')),
  department TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(active);

-- ============= QUERY_LOGS TABLE =============
-- Audit trail cho mọi query (RAG-F-10, RAG-D-04)
CREATE TABLE query_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  session_id UUID, -- Episode làm việc
  agent TEXT NOT NULL CHECK (agent IN ('knowledge', 'explainer', 'reporter', 'document-sourcing')),
  query TEXT NOT NULL,
  retrieved_sources JSONB, -- Array of chunk IDs
  output_text TEXT,
  citations JSONB, -- Array of citation objects
  latency_ms INTEGER,
  model_version TEXT,
  approved_by UUID REFERENCES users(id),
  approval_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index cho audit và analytics
CREATE INDEX idx_query_logs_user_id ON query_logs(user_id);
CREATE INDEX idx_query_logs_agent ON query_logs(agent);
CREATE INDEX idx_query_logs_created_at ON query_logs(created_at DESC);
CREATE INDEX idx_query_logs_session_id ON query_logs(session_id);

-- ============= TEMPLATES TABLE =============
-- Report templates (PCXR, etc.)
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  schema JSONB NOT NULL, -- JSON schema cho template
  template_text TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  version TEXT NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(name, version)
);

CREATE INDEX idx_templates_active ON templates(active);

-- ============= FEEDBACK TABLE =============
-- User feedback cho query results
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_log_id UUID NOT NULL REFERENCES query_logs(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  corrected_output TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feedback_query_log_id ON feedback(query_log_id);
CREATE INDEX idx_feedback_rating ON feedback(rating);

-- ============= SESSIONS TABLE =============
-- Episode làm việc (optional, có thể thêm sau)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_ref TEXT NOT NULL, -- Anonymized patient ID
  age INTEGER,
  clinical_data JSONB,
  detection_json JSONB,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'archived')) DEFAULT 'active',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_created_by ON sessions(created_by);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_created_at ON sessions(created_at DESC);

-- ============= FUNCTIONS =============

-- Function: match_chunks (vector similarity search với metadata filter)
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding VECTOR(768),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10,
  filter_document_ids UUID[] DEFAULT NULL,
  filter_sources TEXT[] DEFAULT NULL,
  filter_access_levels TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  content TEXT,
  similarity FLOAT,
  metadata JSONB,
  document_title TEXT,
  document_version TEXT,
  document_source TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS chunk_id,
    c.document_id,
    c.content,
    1 - (c.embedding <=> query_embedding) AS similarity,
    c.metadata,
    d.title AS document_title,
    d.version AS document_version,
    d.source AS document_source
  FROM chunks c
  JOIN documents d ON c.document_id = d.id
  WHERE
    d.status = 'active'
    AND c.effective_date <= CURRENT_DATE
    AND (c.expiry_date IS NULL OR c.expiry_date > CURRENT_DATE)
    AND (filter_document_ids IS NULL OR d.id = ANY(filter_document_ids))
    AND (filter_sources IS NULL OR d.source = ANY(filter_sources))
    AND (filter_access_levels IS NULL OR d.access_level = ANY(filter_access_levels))
    AND (1 - (c.embedding <=> query_embedding)) >= match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function: update_updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers cho updated_at
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============= COMMENTS =============
COMMENT ON TABLE documents IS 'Metadata của tài liệu y khoa nguồn';
COMMENT ON TABLE chunks IS 'Vector embeddings của document chunks (768 dims)';
COMMENT ON TABLE users IS 'Người dùng hệ thống, sync với Supabase Auth';
COMMENT ON TABLE query_logs IS 'Audit trail cho mọi query và agent execution';
COMMENT ON TABLE templates IS 'Report templates (PCXR, etc.)';
COMMENT ON TABLE feedback IS 'User feedback cho query results';
COMMENT ON TABLE sessions IS 'Episode làm việc lâm sàng';
COMMENT ON FUNCTION match_chunks IS 'Vector similarity search với metadata filtering và RBAC';
