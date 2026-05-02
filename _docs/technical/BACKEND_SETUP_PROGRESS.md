---
noteId: "9abe33f0452c11f1b3ce19fa7351e6bb"
tags: []

---

# Backend Setup Progress Report

**Ngày**: 2026-05-01  
**Thời gian**: 07:07 UTC  
**Giai đoạn**: Sprint 0 - Foundation

---

## ✅ Đã hoàn thành (6/9 tasks)

### 1. Setup Embedding Model trên A100 ✅
**Status**: DONE

**Kết quả benchmark**:
- Model: `nomic-embed-text` (137M params, 768 dimensions)
- Đã có sẵn trên Ollama server
- Performance:
  - Single embedding: ~167ms average
  - Batch throughput: 6 texts/sec
  - Latency range: 207-915ms (first call slower due to cold start)

**URL**: `https://grew-hypothesis-mothers-flooring.trycloudflare.com`

**Files created**:
- `scripts/benchmark-embedding.js` - Benchmark tool

---

### 2. Cấu trúc thư mục Backend ✅
**Status**: DONE

**Structure**:
```
webrag/
├── apps/
│   └── api/                    # Backend API server
│       ├── src/
│       │   ├── routes/
│       │   ├── agents/
│       │   └── lib/
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── shared/                 # Shared types + Zod schemas
│   │   ├── src/
│   │   │   ├── document.ts
│   │   │   ├── detection.ts
│   │   │   ├── api.ts
│   │   │   ├── agent.ts
│   │   │   ├── user.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── db/                     # Supabase client + migrations
│   │   ├── src/
│   │   │   ├── client.ts
│   │   │   ├── migrations/
│   │   │   │   └── 001_initial_schema.sql
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── llm/                    # Ollama client, prompts, guardrails
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── rag/                    # RAG core logic
│       ├── src/
│       │   ├── embedding/
│       │   │   └── service.ts
│       │   ├── chunking/
│       │   │   └── semantic-chunker.ts
│       │   ├── retrieval/
│       │   ├── guardrails/
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
└── scripts/                    # CLI tools
    └── benchmark-embedding.js
```

---

### 3. Shared Types Package (Zod Schemas) ✅
**Status**: DONE

**Files created**:
- `packages/shared/src/document.ts` - Document & Chunk schemas
- `packages/shared/src/detection.ts` - Detection JSON schemas
- `packages/shared/src/api.ts` - API request/response schemas
- `packages/shared/src/agent.ts` - Agent schemas
- `packages/shared/src/user.ts` - User & RBAC schemas
- `packages/shared/src/index.ts` - Exports

**Key schemas**:
- `RAGQueryRequest/Response` - Knowledge Agent API
- `ExplainRequest/Response` - Explainer Agent API
- `DraftReportRequest/Response` - Reporter Agent API
- `DocumentMetadata` - Document metadata với versioning
- `ChunkMetadata` - Chunk metadata với page/section/heading
- `Citation` - Citation với document reference
- `DetectionResult` - Detection JSON từ AI model

**Benefit**: Frontend và Backend dùng chung types → type-safe, no schema drift

---

### 4. Database Schema + Migrations ✅
**Status**: DONE

**File**: `packages/db/src/migrations/001_initial_schema.sql`

**Tables created**:
1. **documents** - Metadata của tài liệu nguồn
   - Versioning support (title + version unique)
   - Status: draft, active, superseded, retired
   - Access level: public, clinician, radiologist, researcher, admin
   - Effective/expiry dates

2. **chunks** - Vector embeddings (768 dims)
   - HNSW index cho vector similarity search
   - Metadata: page, section, heading, tokens
   - Foreign key → documents (CASCADE delete)

3. **users** - Người dùng (sync với Supabase Auth)
   - Role: clinician, radiologist, researcher, admin
   - RBAC support

4. **query_logs** - Audit trail
   - User, agent, query, output, citations
   - Latency tracking
   - Approval workflow (approved_by, approval_note)

5. **templates** - Report templates (PCXR, etc.)
   - JSON schema cho template
   - Versioning support

6. **feedback** - User feedback
   - Rating 1-5
   - Corrected output
   - Link to query_logs

7. **sessions** - Episode làm việc (optional)
   - Patient ref (anonymized)
   - Clinical data + detection JSON

**Functions**:
- `match_chunks()` - Vector similarity search với metadata filtering và RBAC
- `update_updated_at_column()` - Auto-update timestamps

**Indexes**:
- HNSW index trên chunks.embedding (m=16, ef_construction=64)
- GIN index trên chunks.metadata
- B-tree indexes trên foreign keys và filter columns

**Compliance**:
- ✅ RAG-D-05: Document versioning
- ✅ RAG-D-06: RBAC support
- ✅ RAG-D-07: Expiry date handling
- ✅ RAG-F-10: Audit trail
- ✅ RAG-D-04: Query logging

---

### 5. Embedding Service Wrapper ✅
**Status**: DONE

**File**: `packages/rag/src/embedding/service.ts`

**Features**:
- `embedText()` - Single text embedding
- `embedBatch()` - Parallel batch embedding
- `embedBatchChunked()` - Chunked batch (để tránh overload)
- `checkEmbeddingHealth()` - Health check

**Error handling**:
- Retry logic với exponential backoff (max 3 retries)
- Timeout support (default 30s)
- AbortController cho request cancellation
- Validation errors không retry

**Performance**:
- Batch parallel với Promise.all
- Chunked batch cho large datasets

---

### 6. Chunking Logic ✅
**Status**: DONE

**File**: `packages/rag/src/chunking/semantic-chunker.ts`

**Configuration** (theo architect review):
- Chunk size: **768 tokens** (tăng từ 512)
- Overlap: **192 tokens** (25% overlap, tăng từ 128)
- Preserve sections: YES (detect headings)

**Features**:
- `chunkDocument()` - Chunk single document
- `chunkPages()` - Chunk multiple pages (for PDF)
- `validateChunk()` - Quality validation
- `getChunkingStats()` - Statistics

**Section detection**:
- Markdown headings: #, ##, ###
- Numbered sections: 1., 2., 3.
- Colon headings: "Introduction:", "Methods:"

**Metadata preserved**:
- Page number
- Section heading
- Token count

---

## 🚧 Đang làm / Chưa làm (3/9 tasks)

### 7. Retrieval Service (vector search + rerank) ⏳
**Status**: PENDING

**Cần làm**:
- Vector search với pgvector (dùng `match_chunks()` function)
- Metadata filtering (source, date range, access level)
- Reranking với `bge-reranker-base` (optional, có thể skip Sprint 0)
- Top-K selection

**File**: `packages/rag/src/retrieval/retriever.ts`

---

### 8. Citation Verification Layer ⏳
**Status**: PENDING - **ƯU TIÊN CAO**

**Cần làm** (theo architect review):
1. Parse citations từ LLM output
2. Verify mỗi citation có tồn tại trong retrieved chunks không
3. Verify excerpt match với chunk content
4. Nếu citation sai → refuse safely hoặc remove citation

**File**: `packages/rag/src/guardrails/citation-verifier.ts`

**Importance**: Đây là gap an toàn lớn nhất hiện tại

---

### 9. Knowledge Agent Implementation ⏳
**Status**: PENDING

**Cần làm**:
- Query → embed query → retrieve chunks → construct prompt → LLM generate → verify citations → response
- Guardrails: refuse safely khi không đủ bằng chứng
- Latency target: < 3s

**File**: `apps/api/src/agents/knowledge-agent.ts`

---

## 📋 Bước tiếp theo

### Bước 1: Apply database migration
```bash
# Cần SUPABASE_SERVICE_ROLE_KEY trong .env
cd packages/db
# Run migration manually hoặc qua Supabase dashboard
```

### Bước 2: Install dependencies
```bash
# Root level
yarn install

# Hoặc npm install nếu dùng npm
```

### Bước 3: Test embedding service
```bash
node scripts/benchmark-embedding.js
```

### Bước 4: Implement retrieval service
- Vector search với pgvector
- Test với mock data

### Bước 5: Implement citation verification
- **ƯU TIÊN CAO** theo architect review
- Parse + verify citations

### Bước 6: Implement Knowledge Agent
- End-to-end RAG pipeline
- Test với real queries

---

## 🔧 Environment Variables cần thiết

### Hiện có trong `.env`:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://mibtdruhmmcatccdzjjk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
DATABASE_URL=postgresql://postgres:...
OLLAMA_URL=https://grew-hypothesis-mothers-flooring.trycloudflare.com
```

### Cần thêm:
```bash
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>  # Để bypass RLS
```

---

## 📊 Architect Review Highlights

### Đã điều chỉnh theo review:
✅ Chunk size: 512 → **768 tokens**  
✅ Overlap: 128 → **192 tokens**  
✅ Bỏ hybrid retrieval (BM25) → chỉ vector search  
✅ Database: HNSW index thay vì IVFFlat  
✅ Citation verification: ưu tiên cao nhất  

### Chưa implement (có thể skip Sprint 0):
- Reranking layer (bge-reranker-base)
- Job queue cho async tasks
- Streaming responses (SSE)
- Monitoring + observability

---

## 🎯 Sprint 0 Goal

**Mục tiêu**: Có RAG pipeline cơ bản hoạt động

**Deliverable**:
- Backend có thể nhận query → retrieve → generate → verify citations → trả về response
- Frontend có thể gọi API (dù chưa integrate)

**Timeline**: 1-2 tuần

---

## 📝 Notes

1. **Cloudflare URL thay đổi**: URL Ollama sẽ thay đổi mỗi khi restart. Cần update `.env` hoặc dùng fixed hostname.

2. **Service role key**: Cần lấy từ Supabase dashboard → Settings → API → service_role key (secret).

3. **Migration**: Chạy SQL trong `001_initial_schema.sql` qua Supabase SQL Editor hoặc migration tool.

4. **Monorepo**: Dùng yarn workspaces. Chạy `yarn install` ở root để link packages.

5. **TypeScript**: Tất cả packages dùng TypeScript strict mode.

---

**Tạo bởi**: Claude (Backend Dev 2)  
**Ngày**: 2026-05-01
