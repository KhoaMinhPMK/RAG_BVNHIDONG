-- Database Optimization for WebRAG
-- Purpose: Improve query performance, add missing indexes, optimize vector search
-- Date: 2026-05-02
-- Owner: BE3 (DevOps)

-- ============================================================================
-- 1. ANALYZE CURRENT INDEXES
-- ============================================================================

-- Check existing indexes
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Check table sizes
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================================================
-- 2. ADD MISSING INDEXES
-- ============================================================================

-- Documents table indexes
CREATE INDEX IF NOT EXISTS idx_documents_content_hash
ON documents(content_hash);

CREATE INDEX IF NOT EXISTS idx_documents_source_type
ON documents(source_type);

CREATE INDEX IF NOT EXISTS idx_documents_created_at
ON documents(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_documents_updated_at
ON documents(updated_at DESC);

-- Chunks table indexes
CREATE INDEX IF NOT EXISTS idx_chunks_document_id
ON chunks(document_id);

CREATE INDEX IF NOT EXISTS idx_chunks_chunk_index
ON chunks(chunk_index);

CREATE INDEX IF NOT EXISTS idx_chunks_created_at
ON chunks(created_at DESC);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_chunks_document_chunk
ON chunks(document_id, chunk_index);

-- Episodes table indexes (if exists)
CREATE INDEX IF NOT EXISTS idx_episodes_episode_number
ON episodes(episode_number);

CREATE INDEX IF NOT EXISTS idx_episodes_created_at
ON episodes(created_at DESC);

-- ============================================================================
-- 3. VECTOR SEARCH OPTIMIZATION
-- ============================================================================

-- Create IVFFlat index for vector similarity search
-- Note: Requires pgvector extension
-- IVFFlat is faster than exact search for large datasets

-- For chunks table (embedding column)
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_ivfflat
ON chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Alternative: HNSW index (better for high-dimensional vectors)
-- Uncomment if you prefer HNSW over IVFFlat
-- CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw
-- ON chunks USING hnsw (embedding vector_cosine_ops)
-- WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- 4. OPTIMIZE VECTOR SEARCH FUNCTION
-- ============================================================================

-- Drop existing function if exists
DROP FUNCTION IF EXISTS match_document_chunks(vector, int, float);

-- Recreated optimized version
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(768),
  match_count int DEFAULT 10,
  similarity_threshold float DEFAULT 0.7
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  chunk_index int,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.document_id,
    c.content,
    c.chunk_index,
    1 - (c.embedding <=> query_embedding) as similarity
  FROM chunks c
  WHERE 1 - (c.embedding <=> query_embedding) > similarity_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- 5. ADD QUERY PERFORMANCE MONITORING
-- ============================================================================

-- Enable pg_stat_statements extension for query monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View slow queries
CREATE OR REPLACE VIEW slow_queries AS
SELECT
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    max_exec_time,
    stddev_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100 -- queries slower than 100ms
ORDER BY mean_exec_time DESC
LIMIT 20;

-- ============================================================================
-- 6. VACUUM AND ANALYZE
-- ============================================================================

-- Vacuum tables to reclaim space and update statistics
VACUUM ANALYZE documents;
VACUUM ANALYZE chunks;
VACUUM ANALYZE episodes;

-- ============================================================================
-- 7. CONNECTION POOLING SETUP (PgBouncer)
-- ============================================================================

-- Supabase provides PgBouncer by default
-- Connection string format:
-- postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:6543/postgres

-- Recommended pool settings:
-- - pool_mode = transaction (for most apps)
-- - max_client_conn = 100
-- - default_pool_size = 20

-- ============================================================================
-- 8. MATERIALIZED VIEWS (Optional - for heavy aggregations)
-- ============================================================================

-- Example: Document statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS document_stats AS
SELECT
    d.id,
    d.title,
    d.source_type,
    COUNT(c.id) as chunk_count,
    AVG(LENGTH(c.content)) as avg_chunk_length,
    d.created_at
FROM documents d
LEFT JOIN chunks c ON c.document_id = d.id
GROUP BY d.id, d.title, d.source_type, d.created_at;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_document_stats_source_type
ON document_stats(source_type);

-- Refresh materialized view (run periodically)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY document_stats;

-- ============================================================================
-- 9. PARTITIONING (Optional - for very large tables)
-- ============================================================================

-- Example: Partition chunks table by created_at (monthly)
-- Only implement if chunks table > 10M rows

-- CREATE TABLE chunks_partitioned (
--     LIKE chunks INCLUDING ALL
-- ) PARTITION BY RANGE (created_at);

-- CREATE TABLE chunks_2026_05 PARTITION OF chunks_partitioned
--     FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

-- ============================================================================
-- 10. QUERY OPTIMIZATION TIPS
-- ============================================================================

-- Use EXPLAIN ANALYZE to check query performance
-- Example:
-- EXPLAIN ANALYZE
-- SELECT * FROM match_document_chunks('[0.1, 0.2, ...]'::vector, 10, 0.7);

-- Check index usage
-- SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'public';

-- Check table bloat
-- SELECT
--     schemaname, tablename,
--     pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
--     pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
--     pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS index_size
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- 1. Check if indexes were created
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename;

-- 2. Test vector search performance
-- EXPLAIN ANALYZE
-- SELECT * FROM match_document_chunks(
--   (SELECT embedding FROM chunks LIMIT 1),
--   10,
--   0.7
-- );

-- 3. Check index sizes
SELECT
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexname::regclass) DESC;

-- ============================================================================
-- MAINTENANCE SCHEDULE
-- ============================================================================

-- Daily: Auto-vacuum (handled by Supabase)
-- Weekly: VACUUM ANALYZE (manual or scheduled)
-- Monthly: REINDEX (if needed)
-- Monthly: Refresh materialized views

-- ============================================================================
-- NOTES
-- ============================================================================

-- 1. IVFFlat index requires training data
--    - Build index after inserting at least 1000 rows
--    - Rebuild index periodically as data grows

-- 2. Vector index parameters:
--    - lists: number of clusters (typically sqrt(rows))
--    - For 10K rows: lists = 100
--    - For 100K rows: lists = 316
--    - For 1M rows: lists = 1000

-- 3. Connection pooling:
--    - Use PgBouncer connection string for API
--    - Use direct connection for migrations
--    - Port 6543 = PgBouncer
--    - Port 5432 = Direct Postgres

-- 4. Query performance targets:
--    - Simple queries: < 50ms (p95)
--    - Vector search: < 200ms (p95)
--    - Complex aggregations: < 500ms (p95)

-- ============================================================================
-- END OF OPTIMIZATION SCRIPT
-- ============================================================================
