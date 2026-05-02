---
noteId: "b747ce50452c11f1b3ce19fa7351e6bb"
tags: []

---

# Hướng dẫn Setup Backend - Các bước tiếp theo

**Cập nhật**: 2026-05-01 07:08 UTC

---

## Bước 1: Lấy Supabase Service Role Key

### 1.1. Truy cập Supabase Dashboard
```
https://supabase.com/dashboard/project/mibtdruhmmcatccdzjjk
```

### 1.2. Lấy Service Role Key
1. Vào **Settings** → **API**
2. Tìm section **Project API keys**
3. Copy **service_role** key (secret, không phải anon key)
4. Key này có quyền bypass Row Level Security (RLS)

### 1.3. Thêm vào `.env`
```bash
# Thêm dòng này vào file .env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

⚠️ **Lưu ý**: Service role key rất quan trọng, không commit vào git!

---

## Bước 2: Apply Database Migration

### Option A: Qua Supabase SQL Editor (Khuyến nghị)

1. Truy cập Supabase Dashboard → **SQL Editor**
2. Click **New query**
3. Copy toàn bộ nội dung file `packages/db/src/migrations/001_initial_schema.sql`
4. Paste vào editor
5. Click **Run** (hoặc Ctrl+Enter)
6. Kiểm tra kết quả:
   - Nếu thành công: "Success. No rows returned"
   - Nếu lỗi: Đọc error message và fix

### Option B: Qua psql CLI

```bash
# Kết nối đến Supabase database
psql "postgresql://postgres:khoaminh345678@db.mibtdruhmmcatccdzjjk.supabase.co:5432/postgres"

# Chạy migration
\i packages/db/src/migrations/001_initial_schema.sql

# Kiểm tra tables đã tạo
\dt

# Kiểm tra pgvector extension
SELECT * FROM pg_extension WHERE extname = 'vector';

# Exit
\q
```

### Verify Migration

Sau khi chạy migration, kiểm tra:

```sql
-- Kiểm tra tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Kết quả mong đợi:
-- chunks
-- documents
-- feedback
-- query_logs
-- sessions
-- templates
-- users

-- Kiểm tra HNSW index
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'chunks';

-- Kiểm tra function match_chunks
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'match_chunks';
```

---

## Bước 3: Install Dependencies

### 3.1. Cài đặt yarn workspaces

```bash
cd /mnt/e/project/webrag

# Install tất cả dependencies
yarn install

# Hoặc nếu dùng npm
npm install
```

### 3.2. Verify installation

```bash
# Kiểm tra packages đã link
ls -la node_modules/@webrag

# Kết quả mong đợi:
# @webrag/db -> ../../packages/db
# @webrag/llm -> ../../packages/llm
# @webrag/rag -> ../../packages/rag
# @webrag/shared -> ../../packages/shared
```

---

## Bước 4: Test Embedding Service

### 4.1. Test benchmark script

```bash
node scripts/benchmark-embedding.js
```

**Kết quả mong đợi**:
```
Ollama Embedding Benchmark
Model: nomic-embed-text
URL: https://grew-hypothesis-mothers-flooring.trycloudflare.com

=== Single Embedding Benchmark ===
Text 1 (27 words):
  Dimensions: 768
  Latency: ~200-900ms
  Speed: ~30-120 tokens/sec

...

✅ Benchmark completed successfully
```

### 4.2. Test embedding service programmatically

Tạo file test:

```bash
# Tạo test script
cat > scripts/test-embedding-service.js << 'EOF'
import { embedText, embedBatch, checkEmbeddingHealth } from '../packages/rag/src/embedding/service.js';

async function main() {
  console.log('Testing embedding service...\n');

  // Test health check
  console.log('1. Health check:');
  const health = await checkEmbeddingHealth();
  console.log(health);

  // Test single embedding
  console.log('\n2. Single embedding:');
  const single = await embedText('Viêm phổi nặng ở trẻ em');
  console.log(`Dimensions: ${single.dimensions}, Latency: ${single.latency}ms`);

  // Test batch
  console.log('\n3. Batch embedding:');
  const batch = await embedBatch([
    'Consolidation on chest X-ray',
    'Pleural effusion',
    'Infiltrate'
  ]);
  console.log(`Count: ${batch.embeddings.length}, Avg latency: ${batch.averageLatency}ms`);

  console.log('\n✅ All tests passed');
}

main().catch(console.error);
EOF

# Chạy test
node scripts/test-embedding-service.js
```

---

## Bước 5: Test Chunking Logic

```bash
# Tạo test script
cat > scripts/test-chunking.js << 'EOF'
import { chunkDocument, getChunkingStats } from '../packages/rag/src/chunking/semantic-chunker.js';

const sampleText = `
# Viêm phổi nặng ở trẻ em

## Định nghĩa
Viêm phổi nặng ở trẻ em được định nghĩa khi có ít nhất một trong các dấu hiệu sau:
- Co rút lồng ngực
- Thở rên
- Tím tái
- SpO2 < 92%

## Tiêu chuẩn nhập viện
Theo hướng dẫn của BYT Việt Nam 2020, trẻ em cần nhập viện khi:
1. Có dấu hiệu viêm phổi nặng
2. Không đáp ứng với điều trị ngoại trú
3. Có bệnh lý nền

## Điều trị
Điều trị viêm phổi nặng bao gồm:
- Kháng sinh đường tĩnh mạch
- Oxy liệu pháp
- Theo dõi sát
`;

async function main() {
  console.log('Testing chunking logic...\n');

  const chunks = chunkDocument(sampleText, { page: 1 });
  
  console.log(`Total chunks: ${chunks.length}\n`);
  
  chunks.forEach((chunk, i) => {
    console.log(`Chunk ${i}:`);
    console.log(`  Section: ${chunk.metadata.section || 'N/A'}`);
    console.log(`  Tokens: ${chunk.metadata.tokens}`);
    console.log(`  Content preview: ${chunk.content.slice(0, 100)}...`);
    console.log();
  });

  const stats = getChunkingStats(chunks);
  console.log('Statistics:');
  console.log(stats);
}

main().catch(console.error);
EOF

# Chạy test
node scripts/test-chunking.js
```

---

## Bước 6: Seed Database với Sample Data

### 6.1. Tạo sample documents

```sql
-- Insert sample document
INSERT INTO documents (
  title,
  version,
  source,
  effective_date,
  owner,
  status,
  language,
  access_level
) VALUES (
  'WHO Guideline: Management of Pneumonia in Children Under 5',
  '2023',
  'WHO',
  '2023-01-01',
  'WHO Technical Team',
  'active',
  'en',
  'public'
) RETURNING id;

-- Lưu lại document_id để dùng cho chunks
```

### 6.2. Tạo indexing script

```bash
# File: scripts/index-sample-document.js
# TODO: Implement sau khi có retrieval service
```

---

## Bước 7: Implement Retrieval Service (Next)

### File cần tạo: `packages/rag/src/retrieval/retriever.ts`

**Chức năng**:
1. Embed query text
2. Call `match_chunks()` function với filters
3. Parse results
4. (Optional) Rerank với bge-reranker-base
5. Return top-K chunks

**Signature**:
```typescript
export async function retrieveChunks(
  query: string,
  options: {
    maxResults?: number;
    filters?: {
      sources?: string[];
      accessLevels?: string[];
      documentIds?: string[];
    };
    rerank?: boolean;
  }
): Promise<RetrievedChunk[]>
```

---

## Bước 8: Implement Citation Verification (Next)

### File cần tạo: `packages/rag/src/guardrails/citation-verifier.ts`

**Chức năng**:
1. Parse citations từ LLM output (regex hoặc structured output)
2. Verify mỗi citation:
   - Document ID có trong retrieved chunks không?
   - Excerpt có match với chunk content không?
3. Return verification result + warnings

**Signature**:
```typescript
export function verifyCitations(
  llmOutput: string,
  retrievedChunks: RetrievedChunk[]
): {
  verified: boolean;
  validCitations: Citation[];
  invalidCitations: Citation[];
  warnings: string[];
}
```

---

## Bước 9: Implement Knowledge Agent (Next)

### File cần tạo: `apps/api/src/agents/knowledge-agent.ts`

**Flow**:
```
Query 
  → Embed query
  → Retrieve chunks (with filters)
  → Construct prompt (query + chunks + guardrails)
  → LLM generate
  → Parse output + citations
  → Verify citations
  → Return response
```

---

## Troubleshooting

### Lỗi: "pgvector extension not found"
```sql
-- Chạy trong Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS vector;
```

### Lỗi: "HNSW index creation failed"
```
Nguyên nhân: PostgreSQL version < 16
Giải pháp: Dùng IVFFlat thay vì HNSW
```

### Lỗi: "Ollama connection timeout"
```bash
# Kiểm tra Ollama server
curl https://grew-hypothesis-mothers-flooring.trycloudflare.com/api/tags

# Nếu URL thay đổi, update .env
```

### Lỗi: "Workspace packages not found"
```bash
# Re-install dependencies
rm -rf node_modules
yarn install
```

---

## Checklist

- [ ] Lấy Supabase service role key
- [ ] Apply database migration
- [ ] Install dependencies (yarn install)
- [ ] Test embedding service
- [ ] Test chunking logic
- [ ] Seed sample data
- [ ] Implement retrieval service
- [ ] Implement citation verification
- [ ] Implement Knowledge Agent
- [ ] End-to-end test

---

**Next**: Sau khi hoàn thành checklist, bạn sẽ có RAG pipeline cơ bản hoạt động!
