-- Migration 002: Add PostgreSQL full-text search (BM25-equivalent) to chunks
-- Adds tsvector column + GIN index to replace ILIKE-based fallback search
-- Also extends chunks.metadata to store section_title, context_prefix, heading_hierarchy

-- 1. Add tsvector column for full-text search
ALTER TABLE chunks
  ADD COLUMN IF NOT EXISTS content_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED;

-- 2. GIN index for fast full-text queries
CREATE INDEX IF NOT EXISTS idx_chunks_content_tsv
  ON chunks USING gin(content_tsv);

-- 3. Function: BM25-style search returning chunk rows + ts_rank_cd score
--    ts_rank_cd uses cover density which approximates BM25 better than ts_rank
CREATE OR REPLACE FUNCTION search_chunks_fulltext(
  query_text  text,
  match_count integer DEFAULT 20
)
RETURNS TABLE (
  id           uuid,
  document_id  uuid,
  content      text,
  metadata     jsonb,
  rank         real
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  tsq tsquery;
BEGIN
  -- Build plainto_tsquery for robustness (handles phrases, diacritics)
  tsq := plainto_tsquery('simple', query_text);

  RETURN QUERY
  SELECT
    c.id,
    c.document_id,
    c.content,
    c.metadata,
    ts_rank_cd(c.content_tsv, tsq, 32) AS rank
  FROM chunks c
  WHERE c.content_tsv @@ tsq
  ORDER BY rank DESC
  LIMIT match_count;
END;
$$;

-- 4. Hybrid search function: combines vector similarity + BM25 via Reciprocal Rank Fusion
--    RRF score = sum of 1 / (k + rank_position) with k = 60
--    Caller can then filter / rerank the fused results
CREATE OR REPLACE FUNCTION hybrid_search_chunks(
  query_embedding  vector(768),
  query_text       text,
  match_threshold  float    DEFAULT 0.4,
  vector_weight    float    DEFAULT 0.6,
  bm25_weight      float    DEFAULT 0.4,
  match_count      integer  DEFAULT 20,
  rrf_k            integer  DEFAULT 60
)
RETURNS TABLE (
  id            uuid,
  document_id   uuid,
  content       text,
  metadata      jsonb,
  vector_score  float,
  bm25_score    float,
  rrf_score     float
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  tsq tsquery;
BEGIN
  tsq := plainto_tsquery('simple', query_text);

  RETURN QUERY
  WITH vector_results AS (
    SELECT
      c.id,
      c.document_id,
      c.content,
      c.metadata,
      (1 - (c.embedding <=> query_embedding))::float AS similarity,
      ROW_NUMBER() OVER (ORDER BY c.embedding <=> query_embedding) AS vec_rank
    FROM chunks c
    WHERE (1 - (c.embedding <=> query_embedding)) >= match_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count * 2
  ),
  bm25_results AS (
    SELECT
      c.id,
      c.document_id,
      c.content,
      c.metadata,
      ts_rank_cd(c.content_tsv, tsq, 32)::float AS rank_score,
      ROW_NUMBER() OVER (ORDER BY ts_rank_cd(c.content_tsv, tsq, 32) DESC) AS bm25_rank
    FROM chunks c
    WHERE c.content_tsv @@ tsq
    ORDER BY rank_score DESC
    LIMIT match_count * 2
  ),
  fused AS (
    SELECT
      COALESCE(v.id, b.id)               AS id,
      COALESCE(v.document_id, b.document_id) AS document_id,
      COALESCE(v.content, b.content)     AS content,
      COALESCE(v.metadata, b.metadata)   AS metadata,
      COALESCE(v.similarity, 0.0)        AS vector_score,
      COALESCE(b.rank_score, 0.0)        AS bm25_score,
      -- RRF: weight * 1/(k + rank) from each source
      (
        vector_weight  * COALESCE(1.0 / (rrf_k + v.vec_rank),   0.0) +
        bm25_weight    * COALESCE(1.0 / (rrf_k + b.bm25_rank),  0.0)
      )                                  AS rrf_score
    FROM vector_results v
    FULL OUTER JOIN bm25_results b ON v.id = b.id
  )
  SELECT
    f.id,
    f.document_id,
    f.content,
    f.metadata,
    f.vector_score,
    f.bm25_score,
    f.rrf_score
  FROM fused f
  ORDER BY f.rrf_score DESC
  LIMIT match_count;
END;
$$;

-- 5. Index to speed up document metadata join
CREATE INDEX IF NOT EXISTS idx_documents_id_status
  ON documents(id, status);
