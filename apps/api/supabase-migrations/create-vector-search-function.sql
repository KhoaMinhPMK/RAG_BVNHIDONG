-- ============================================================================
-- CREATE VECTOR SIMILARITY SEARCH FUNCTION
-- ============================================================================
-- This function performs vector similarity search on document_chunks table
-- using pgvector's cosine similarity operator (<=>)

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
    dc.id AS chunk_id,
    dc.document_id,
    dc.content,
    1 - (dc.embedding <=> query_embedding) AS similarity,
    d.title AS document_title,
    d.version AS document_version,
    d.effective_date,
    dc.chunk_index
  FROM document_chunks dc
  JOIN documents d ON dc.document_id = d.id
  WHERE 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- CREATE INDEX FOR VECTOR SIMILARITY SEARCH
-- ============================================================================
-- HNSW index for fast approximate nearest neighbor search
-- Using cosine distance (vector_cosine_ops)

CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
ON document_chunks
USING hnsw (embedding vector_cosine_ops);

-- ============================================================================
-- VERIFY FUNCTION
-- ============================================================================
-- Test the function with a dummy embedding
-- SELECT * FROM match_document_chunks(
--   array_fill(0.0, ARRAY[768])::vector(768),
--   0.5,
--   5
-- );
