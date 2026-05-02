# Database Optimization Guide

Hướng dẫn tối ưu hóa database cho WebRAG API.

## 📋 Overview

**Database:** PostgreSQL (Supabase)  
**Extensions:** pgvector, pg_stat_statements  
**Connection:** PgBouncer pooling

## 🎯 Optimization Goals

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Simple queries (p95) | ? | < 50ms | 🎯 |
| Vector search (p95) | ? | < 200ms | 🎯 |
| Complex queries (p95) | ? | < 500ms | 🎯 |
| Index hit rate | ? | > 95% | 🎯 |
| Connection pool usage | ? | < 80% | 🎯 |

## 🚀 Quick Start

### 1. Run Optimization Script

```bash
# Connect to Supabase
psql $DATABASE_URL -f apps/api/database-optimization.sql

# Or via Supabase Dashboard
# 1. Go to SQL Editor
# 2. Copy content from database-optimization.sql
# 3. Run query
```

### 2. Verify Indexes

```sql
-- Check created indexes
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname LIKE 'idx_%'
ORDER BY tablename;
```

### 3. Test Performance

```sql
-- Test vector search
EXPLAIN ANALYZE
SELECT * FROM match_document_chunks(
  (SELECT embedding FROM chunks LIMIT 1),
  10,
  0.7
);
```

## 📊 Indexes Created

### Documents Table

```sql
idx_documents_content_hash    -- Fast duplicate detection
idx_documents_source_type     -- Filter by source
idx_documents_created_at      -- Sort by date
idx_documents_updated_at      -- Track updates
```

### Chunks Table

```sql
idx_chunks_document_id        -- Join with documents
idx_chunks_chunk_index        -- Order chunks
idx_chunks_created_at         -- Sort by date
idx_chunks_document_chunk     -- Composite for common queries
idx_chunks_embedding_ivfflat  -- Vector similarity search
```

### Episodes Table

```sql
idx_episodes_episode_number   -- Find by episode
idx_episodes_created_at       -- Sort by date
```

## 🔍 Vector Search Optimization

### IVFFlat Index

**Pros:**
- Faster than exact search for large datasets
- Good balance of speed and accuracy
- Lower memory usage

**Cons:**
- Requires training data (min 1000 rows)
- Needs periodic rebuilding

**Configuration:**
```sql
CREATE INDEX idx_chunks_embedding_ivfflat 
ON chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

**Lists parameter:**
- 10K rows → lists = 100
- 100K rows → lists = 316
- 1M rows → lists = 1000
- Formula: `lists = sqrt(total_rows)`

### HNSW Index (Alternative)

**Pros:**
- Better accuracy than IVFFlat
- No training required
- Better for high-dimensional vectors

**Cons:**
- Higher memory usage
- Slower index build time

**Configuration:**
```sql
CREATE INDEX idx_chunks_embedding_hnsw 
ON chunks USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

## 🔧 Connection Pooling

### PgBouncer (Supabase)

**Connection strings:**

```bash
# Direct connection (migrations, admin tasks)
postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres

# Pooled connection (API, applications)
postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:6543/postgres
```

**Recommended settings:**
- `pool_mode = transaction`
- `max_client_conn = 100`
- `default_pool_size = 20`

**Usage in code:**
```typescript
// Use pooled connection for API
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    db: {
      schema: 'public',
    },
    auth: {
      persistSession: false,
    },
  }
);
```

## 📈 Performance Monitoring

### 1. Enable pg_stat_statements

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

### 2. View Slow Queries

```sql
SELECT * FROM slow_queries;
```

### 3. Check Index Usage

```sql
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### 4. Check Table Sizes

```sql
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size('public.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size('public.'||tablename) - pg_relation_size('public.'||tablename)) AS index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.'||tablename) DESC;
```

## 🧹 Maintenance

### Daily (Automatic)

Supabase handles automatic maintenance:
- Auto-vacuum
- Statistics updates
- Dead tuple cleanup

### Weekly (Manual)

```sql
-- Vacuum and analyze all tables
VACUUM ANALYZE documents;
VACUUM ANALYZE chunks;
VACUUM ANALYZE episodes;
```

### Monthly (Manual)

```sql
-- Reindex if needed (check for bloat first)
REINDEX TABLE chunks;

-- Refresh materialized views
REFRESH MATERIALIZED VIEW CONCURRENTLY document_stats;

-- Rebuild vector index (if data grew significantly)
DROP INDEX idx_chunks_embedding_ivfflat;
CREATE INDEX idx_chunks_embedding_ivfflat 
ON chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 316); -- Adjust based on row count
```

## 🎯 Query Optimization Tips

### 1. Use EXPLAIN ANALYZE

```sql
EXPLAIN ANALYZE
SELECT * FROM documents 
WHERE source_type = 'medical' 
ORDER BY created_at DESC 
LIMIT 10;
```

**Look for:**
- Seq Scan → Add index
- High execution time → Optimize query
- Low rows returned → Adjust filters

### 2. Optimize Vector Search

```sql
-- Good: Use similarity threshold
SELECT * FROM match_document_chunks(
  query_embedding,
  10,
  0.7  -- Only return results > 70% similarity
);

-- Bad: No threshold (returns all rows)
SELECT * FROM match_document_chunks(
  query_embedding,
  10,
  0.0
);
```

### 3. Use Composite Indexes

```sql
-- Query: Get chunks for document, ordered by index
SELECT * FROM chunks 
WHERE document_id = 'xxx' 
ORDER BY chunk_index;

-- Index: Composite covers both WHERE and ORDER BY
CREATE INDEX idx_chunks_document_chunk 
ON chunks(document_id, chunk_index);
```

### 4. Avoid SELECT *

```sql
-- Good: Select only needed columns
SELECT id, content, similarity 
FROM match_document_chunks(...);

-- Bad: Select all columns
SELECT * FROM match_document_chunks(...);
```

## 🚨 Troubleshooting

### Slow Vector Search

**Symptoms:**
- Vector search > 500ms
- High CPU usage

**Solutions:**
1. Check if IVFFlat index exists
2. Rebuild index with correct `lists` parameter
3. Increase similarity threshold
4. Reduce match_count

### High Connection Count

**Symptoms:**
- "too many connections" error
- Connection timeouts

**Solutions:**
1. Use PgBouncer connection (port 6543)
2. Reduce connection pool size in app
3. Close connections properly
4. Check for connection leaks

### Index Not Used

**Symptoms:**
- Query uses Seq Scan instead of Index Scan
- Slow queries despite indexes

**Solutions:**
1. Run VACUUM ANALYZE
2. Check query matches index columns
3. Verify index exists: `\d+ table_name`
4. Check statistics: `SELECT * FROM pg_stats WHERE tablename = 'table_name'`

## 📊 Benchmarking

### Before Optimization

```bash
# Run benchmark
npm run benchmark:db

# Expected results (before):
# - Simple query: 150ms
# - Vector search: 800ms
# - Complex query: 1200ms
```

### After Optimization

```bash
# Run benchmark again
npm run benchmark:db

# Expected results (after):
# - Simple query: 30ms (-80%)
# - Vector search: 150ms (-81%)
# - Complex query: 400ms (-67%)
```

## 🔐 Security

### Read-Only User (for monitoring)

```sql
-- Create read-only user
CREATE USER readonly WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE postgres TO readonly;
GRANT USAGE ON SCHEMA public TO readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly;
```

### Audit Logging

```sql
-- Enable audit logging for sensitive tables
CREATE EXTENSION IF NOT EXISTS pgaudit;

-- Log all queries on documents table
ALTER TABLE documents SET (log_statement = 'all');
```

## 📝 Checklist

**Initial Setup:**
- [ ] Run database-optimization.sql
- [ ] Verify indexes created
- [ ] Test vector search performance
- [ ] Enable pg_stat_statements
- [ ] Configure PgBouncer connection

**Weekly:**
- [ ] Check slow queries
- [ ] Review index usage
- [ ] Run VACUUM ANALYZE
- [ ] Monitor connection pool

**Monthly:**
- [ ] Review table sizes
- [ ] Rebuild vector indexes if needed
- [ ] Refresh materialized views
- [ ] Check for index bloat

---

**Created:** 2026-05-02  
**Owner:** BE3 (DevOps)  
**Status:** ✅ Ready to deploy
