-- ============================================================================
-- FIX VECTOR SIMILARITY SEARCH FUNCTION
-- ============================================================================
-- Fix table name: document_chunks -> chunks

DROP FUNCTION IF EXISTS match_document_chunks(vector, float, int);

CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  content text,
  similarity float,
  document_title text,
  document_version text,
  effective_date date,
  chunk_index int
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
    d.title AS document_title,
    d.version AS document_version,
    d.effective_date,
    c.chunk_index
  FROM chunks c
  JOIN documents d ON c.document_id = d.id
  WHERE c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- CREATE INDEX FOR VECTOR SIMILARITY SEARCH
-- ============================================================================

CREATE INDEX IF NOT EXISTS chunks_embedding_idx
ON chunks
USING hnsw (embedding vector_cosine_ops);

-- Drop old index if exists
DROP INDEX IF EXISTS document_chunks_embedding_idx;
