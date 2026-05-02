---
noteId: "backend_next_feature_plan_20260501"
tags: ["backend", "rag", "ingestion", "multi-llm"]
created: 2026-05-01T13:15:00Z
author: agentFE
---

# Backend Next Feature Plan — Kế hoạch Triển khai Tính năng Tiếp theo

**Ngày:** 2026-05-01  
**Tác giả:** agentFE (Frontend Coordinator)  
**Đối tượng:** agentBE, User

---

## 📊 Tình trạng hiện tại (Status Check)

### ✅ agentUI — Authentication Complete
**Hoàn thành:** 2026-05-01 16:48
- ✅ Supabase SSR clients (browser, server, middleware)
- ✅ Auth Context với useAuth() hook
- ✅ Login page với validation
- ✅ Protected routes middleware
- ✅ Role-based UI rendering
- ✅ User dropdown menu

**Đang làm:** Animation System Expansion (17/20 components)

---

### ✅ agentBE — Backend Auth Integration Complete
**Hoàn thành:** 2026-05-01 17:58
- ✅ Backend MVP (20 files, ~2,390 lines)
- ✅ 3 AI Agents (Knowledge, Explainer, Reporter)
- ✅ Guardrails + RBAC + Audit
- ✅ 3 API endpoints (/query, /explain, /draft)
- ✅ JWT validation middleware (apps/api/src/middleware/auth.ts)
- ✅ Backend server running on http://localhost:3005
- ✅ All endpoints tested và hoạt động

**Status:** ✅ Backend 100% sẵn sàng cho frontend integration

---

### 📋 Database Schema — Đã có đầy đủ
**File:** `packages/db/src/migrations/001_initial_schema.sql`

**Tables đã tạo:**
1. ✅ `documents` — Metadata của tài liệu y khoa
2. ✅ `chunks` — Vector embeddings (768 dims, HNSW index)
3. ✅ `users` — Sync với Supabase Auth
4. ✅ `query_logs` — Audit trail
5. ✅ `templates` — Report templates
6. ✅ `feedback` — User feedback
7. ✅ `sessions` — Episode làm việc

**Functions đã tạo:**
- ✅ `match_chunks()` — Vector similarity search với metadata filtering

**Extensions:**
- ✅ `pgvector` — Vector operations

---

### ⚠️ Thiếu gì? (Gap Analysis)

#### 1. **RAG Ingestion Pipeline — CHƯA CÓ**
**Hiện trạng:**
- ✅ Database schema có sẵn (documents, chunks tables)
- ✅ Vector search function có sẵn (match_chunks)
- ❌ **KHÔNG CÓ** script để ingest PDF → chunks → embeddings
- ❌ **KHÔNG CÓ** embedding generation (nomic-embed-text)
- ❌ **KHÔNG CÓ** chunking strategy implementation

**Hậu quả:**
- Knowledge Agent hiện tại dùng text search tạm thời (line 56 trong knowledge.ts)
- Không có vector embeddings trong database
- RAG retrieval quality thấp (không có semantic search)

**Cần làm:**
- Viết ingestion pipeline để xử lý 10 PDF documents đã tải
- Generate embeddings với nomic-embed-text hoặc model tương đương
- Insert vào `documents` và `chunks` tables

---

#### 2. **Multi-LLM Racing Strategy — ĐÃ CÓ PLAN**
**Hiện trạng:**
- ✅ Plan chi tiết đã viết (MULTI_LLM_RACING_PLAN.md)
- ✅ MiMo API credentials có sẵn
- ❌ Chưa implement
- ❌ Chưa có feedback từ agentFE/agentUI về UI requirements

**Ưu tiên:** MEDIUM (sau khi RAG ingestion xong)

---

## 🎯 Đề xuất: Tính năng tiếp theo

### **Priority 1: RAG Ingestion Pipeline (HIGH)**

**Lý do ưu tiên:**
1. **Foundation cho toàn bộ hệ thống** — Không có embeddings → RAG không hoạt động đúng
2. **Đã có 6/10 documents ready** — 2 PDF + 4 web docs (nếu scrape xong)
3. **Database schema đã sẵn sàng** — Chỉ cần viết ingestion logic
4. **Blocking cho testing** — Không thể test RAG quality nếu không có real embeddings

**Không ưu tiên Multi-LLM Racing vì:**
- Racing là optimization, không phải core functionality
- Cần test RAG quality với single LLM trước
- UI requirements chưa rõ (cần agentUI feedback)

---

## 📋 RAG Ingestion Pipeline — Implementation Plan

### **Phase 1: Document Processing (2-3 giờ)**

#### Task 1.1: PDF Parser
**File mới:** `apps/api/src/lib/ingestion/pdf-parser.ts`

**Features:**
- Parse PDF với `pdf-parse` hoặc `pdfjs-dist`
- Extract text, metadata (title, authors, date)
- Handle tables, figures (optional phase 1)
- Output: clean text + metadata

**Dependencies:**
```bash
cd apps/api
npm install pdf-parse
```

---

#### Task 1.2: Markdown Parser
**File mới:** `apps/api/src/lib/ingestion/markdown-parser.ts`

**Features:**
- Parse markdown files (từ web scraping)
- Extract headers, sections
- Preserve structure
- Output: clean text + metadata

**Dependencies:**
```bash
npm install marked gray-matter
```

---

#### Task 1.3: Chunking Strategy
**File mới:** `apps/api/src/lib/ingestion/chunker.ts`

**Strategy:**
```typescript
interface ChunkConfig {
  maxTokens: 512;        // Max chunk size
  overlapTokens: 50;     // Overlap between chunks
  strategy: 'semantic';  // Chunk by sections/paragraphs
}
```

**Logic:**
1. Split by sections (H1, H2, H3 headers)
2. If section > maxTokens → split by paragraphs
3. If paragraph > maxTokens → split by sentences
4. Add overlap for context continuity

**Output:**
```typescript
interface Chunk {
  content: string;
  metadata: {
    chunkIndex: number;
    section: string;
    heading: string;
    tokens: number;
  };
}
```

---

### **Phase 2: Embedding Generation (1-2 giờ)**

#### Task 2.1: Embedding Client
**File mới:** `apps/api/src/lib/embedding/client.ts`

**Options:**

**Option A: Ollama (nomic-embed-text) — Recommended**
```typescript
// Ollama có nomic-embed-text model (768 dims)
// Free, local, fast
ollama pull nomic-embed-text
```

**Pros:**
- ✅ Free, local
- ✅ 768 dims (match database schema)
- ✅ Đã có Ollama setup

**Cons:**
- ❌ Cần pull model (~500MB)

**Option B: OpenAI (text-embedding-3-small)**
```typescript
// 1536 dims → cần update database schema
// Cost: $0.02 / 1M tokens
```

**Pros:**
- ✅ High quality
- ✅ No local setup

**Cons:**
- ❌ Cost money
- ❌ Cần update schema (768 → 1536 dims)

**Recommendation:** Option A (Ollama nomic-embed-text)

---

#### Task 2.2: Batch Embedding
**File mới:** `apps/api/src/lib/embedding/batch.ts`

**Features:**
- Batch process chunks (10-50 chunks/batch)
- Rate limiting
- Retry logic
- Progress tracking

---

### **Phase 3: Database Insertion (1 giờ)**

#### Task 3.1: Ingestion Service
**File mới:** `apps/api/src/lib/ingestion/service.ts`

**Flow:**
```typescript
async function ingestDocument(filePath: string) {
  // 1. Parse document (PDF or Markdown)
  const { text, metadata } = await parseDocument(filePath);
  
  // 2. Insert document metadata
  const docId = await insertDocument({
    title: metadata.title,
    version: metadata.version || '1.0',
    source: metadata.source || 'Internal',
    effective_date: metadata.date || new Date(),
    status: 'active',
    language: 'vi',
    access_level: 'clinician',
  });
  
  // 3. Chunk text
  const chunks = await chunkText(text, { maxTokens: 512, overlapTokens: 50 });
  
  // 4. Generate embeddings
  const embeddings = await generateEmbeddings(chunks.map(c => c.content));
  
  // 5. Insert chunks with embeddings
  await insertChunks(docId, chunks, embeddings);
  
  return { docId, chunkCount: chunks.length };
}
```

---

#### Task 3.2: CLI Tool
**File mới:** `apps/api/src/scripts/ingest-documents.ts`

**Usage:**
```bash
# Ingest single file
node dist/scripts/ingest-documents.js --file knowledge_base/downloads/03_PERCH_study.pdf

# Ingest all files in folder
node dist/scripts/ingest-documents.js --folder knowledge_base/downloads/

# Dry run (test without inserting)
node dist/scripts/ingest-documents.js --folder knowledge_base/downloads/ --dry-run
```

**Features:**
- Progress bar
- Error handling
- Summary report (X docs, Y chunks, Z embeddings)

---

### **Phase 4: Update Knowledge Agent (30 phút)**

#### Task 4.1: Switch to Vector Search
**File:** `apps/api/src/agents/knowledge.ts`

**Changes:**
```typescript
// OLD (line 52-57): Text search
const { data, error } = await supabase
  .from('documents')
  .select('...')
  .textSearch('content', query, { type: 'websearch' })
  .limit(maxResults);

// NEW: Vector search
// 1. Generate query embedding
const queryEmbedding = await generateEmbedding(query);

// 2. Call match_chunks function
const { data, error } = await supabase.rpc('match_chunks', {
  query_embedding: queryEmbedding,
  match_threshold: 0.7,
  match_count: maxResults,
  filter_access_levels: [role], // RBAC filtering
});
```

---

### **Phase 5: Testing & Validation (1 giờ)**

#### Task 5.1: Test Ingestion
```bash
# 1. Ingest 2 PDF documents
node dist/scripts/ingest-documents.js --file knowledge_base/downloads/03_PERCH_study.pdf
node dist/scripts/ingest-documents.js --file knowledge_base/downloads/04_VinDr_PCXR.pdf

# 2. Verify in database
psql -h ... -d ... -c "SELECT COUNT(*) FROM documents;"
psql -h ... -d ... -c "SELECT COUNT(*) FROM chunks;"
```

#### Task 5.2: Test Vector Search
```bash
# Test query
curl -X POST http://localhost:3005/api/query \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"query": "Triệu chứng viêm phổi ở trẻ em?"}'

# Expected: Answer with citations from ingested documents
```

#### Task 5.3: Quality Metrics
- Retrieval accuracy (manual check top 5 results)
- Latency (< 3s end-to-end)
- Citation relevance

---

## 📁 Files to Create (Total: 8 files)

### New Files
1. `apps/api/src/lib/ingestion/pdf-parser.ts` — PDF parsing
2. `apps/api/src/lib/ingestion/markdown-parser.ts` — Markdown parsing
3. `apps/api/src/lib/ingestion/chunker.ts` — Text chunking
4. `apps/api/src/lib/embedding/client.ts` — Embedding generation
5. `apps/api/src/lib/embedding/batch.ts` — Batch processing
6. `apps/api/src/lib/ingestion/service.ts` — Main ingestion service
7. `apps/api/src/scripts/ingest-documents.ts` — CLI tool
8. `apps/api/src/lib/ingestion/types.ts` — TypeScript types

### Modified Files
1. `apps/api/src/agents/knowledge.ts` — Switch to vector search
2. `apps/api/package.json` — Add dependencies

---

## 🔧 Dependencies to Install

```bash
cd apps/api

# PDF parsing
npm install pdf-parse @types/pdf-parse

# Markdown parsing
npm install marked gray-matter

# Progress bar (CLI)
npm install cli-progress @types/cli-progress

# Token counting
npm install tiktoken
```

---

## ⏱️ Estimated Timeline

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1 | PDF/Markdown parser + Chunker | 2-3 giờ |
| Phase 2 | Embedding client + Batch | 1-2 giờ |
| Phase 3 | Ingestion service + CLI | 1 giờ |
| Phase 4 | Update Knowledge Agent | 30 phút |
| Phase 5 | Testing & Validation | 1 giờ |
| **Total** | | **5-7 giờ** |

**Realistic:** 1-2 ngày (với testing và debugging)

---

## ✅ Success Criteria

### Must Have
- ✅ Ingest 2 PDF documents thành công
- ✅ Generate embeddings (768 dims)
- ✅ Insert vào database (documents + chunks tables)
- ✅ Vector search hoạt động (match_chunks function)
- ✅ Knowledge Agent trả về citations từ ingested docs
- ✅ Latency < 3s

### Nice to Have
- ✅ Ingest 4 markdown documents (từ web scraping)
- ✅ Progress bar trong CLI
- ✅ Dry-run mode
- ✅ Error recovery (resume từ chunk bị lỗi)

---

## 🚀 Rollout Plan

### Day 1 (Morning): Foundation
- [ ] Task 1.1: PDF Parser
- [ ] Task 1.2: Markdown Parser
- [ ] Task 1.3: Chunker
- [ ] Test: Parse 1 PDF, verify chunks

### Day 1 (Afternoon): Embeddings
- [ ] Task 2.1: Embedding Client (Ollama nomic-embed-text)
- [ ] Task 2.2: Batch Embedding
- [ ] Test: Generate embeddings for 10 chunks

### Day 2 (Morning): Ingestion
- [ ] Task 3.1: Ingestion Service
- [ ] Task 3.2: CLI Tool
- [ ] Test: Ingest 1 PDF end-to-end

### Day 2 (Afternoon): Integration & Testing
- [ ] Task 4.1: Update Knowledge Agent
- [ ] Task 5.1-5.3: Testing & Validation
- [ ] Ingest all 6 documents (2 PDF + 4 MD)

---

## 🔗 Dependencies & Blockers

### Dependencies
- ✅ Database schema (đã có)
- ✅ Ollama server running (đã có)
- ✅ Supabase connection (đã có)
- ⏳ Documents ready (2 PDF có, 4 MD cần scrape)

### Potential Blockers
1. **Ollama nomic-embed-text model chưa pull**
   - Solution: `ollama pull nomic-embed-text` (~500MB, 5-10 phút)

2. **PDF parsing quality thấp (tables, figures)**
   - Solution: Phase 1 chỉ extract text, tables/figures để phase 2

3. **Embedding generation chậm**
   - Solution: Batch processing, async/await

4. **Database connection timeout**
   - Solution: Connection pooling, retry logic

---

## 📝 Notes for agentBE

### 🎯 Implementation Guidelines

1. **Start with simplest approach:**
   - Phase 1: Parse 1 PDF, verify text extraction
   - Don't over-engineer chunking strategy
   - Use Ollama nomic-embed-text (local, free)

2. **Error handling:**
   - Log all errors với context (file path, chunk index)
   - Continue on error (don't fail entire batch)
   - Generate summary report

3. **Testing:**
   - Test với 1 PDF trước khi batch process
   - Verify embeddings có đúng dimension (768)
   - Check database constraints (unique, foreign keys)

4. **Performance:**
   - Batch embeddings (10-50 chunks/batch)
   - Use connection pooling cho Supabase
   - Progress tracking cho CLI

5. **Code quality:**
   - TypeScript strict mode
   - Proper error types
   - Unit tests cho chunker (optional phase 1)

---

## 🔄 After RAG Ingestion Complete

### Next Features (Priority Order)

1. **Multi-LLM Racing** (MEDIUM)
   - Implement MiMo API integration
   - Racing strategy (Option C: Hybrid)
   - UI for alternative responses

2. **Document Management UI** (LOW)
   - Admin page để upload/manage documents
   - Re-ingest documents
   - View embeddings stats

3. **RAG Quality Monitoring** (LOW)
   - Track retrieval accuracy
   - User feedback loop
   - A/B testing different chunking strategies

---

## 📚 References

- Database Schema: `packages/db/src/migrations/001_initial_schema.sql`
- Current Knowledge Agent: `apps/api/src/agents/knowledge.ts`
- Ollama Client: `apps/api/src/lib/ollama/client.ts`
- Multi-LLM Plan: `_docs/technical/MULTI_LLM_RACING_PLAN.md`
- Documents Metadata: `knowledge_base/downloads/metadata.json`

---

**Status:** 📋 Plan Ready — Awaiting agentBE Implementation  
**Next Action:** agentBE đọc plan này và bắt đầu Phase 1 (PDF Parser)  
**Estimated Start:** 2026-05-01 (ngay sau khi approve)

---

## ✉️ Message to agentBE

Anh agentBE,

Tôi đã phân tích tình trạng hiện tại và lên kế hoạch chi tiết cho tính năng tiếp theo.

**TL;DR:**
- ✅ Authentication xong rồi (frontend + backend)
- ❌ **RAG Ingestion Pipeline chưa có** → đây là blocker lớn nhất
- 📋 Tôi đề xuất làm RAG Ingestion trước Multi-LLM Racing

**Lý do:**
- RAG Ingestion là foundation, không có embeddings → RAG không hoạt động đúng
- Đã có 6/10 documents ready (2 PDF + 4 web docs)
- Database schema đã sẵn sàng
- Estimated: 5-7 giờ (1-2 ngày)

**Plan chi tiết:**
- 5 phases: PDF Parser → Embeddings → Ingestion → Update Agent → Testing
- 8 files mới, 2 files sửa
- Dependencies: pdf-parse, marked, tiktoken
- CLI tool để ingest documents

Anh đọc plan và cho tôi biết:
1. Có đồng ý ưu tiên RAG Ingestion không?
2. Có câu hỏi gì về implementation không?
3. Khi nào có thể bắt đầu?

Nếu OK, anh bắt đầu Phase 1 (PDF Parser) và ghi log vào `chat1.md` nhé!

— agentFE
