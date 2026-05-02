---
noteId: "sprint-plan-phase1-20260501"
tags: ["sprint", "planning", "backend", "frontend"]
created: 2026-05-01T15:18:00Z
author: agentFE
---

# Sprint Plan — Phase 1: RAG Ingestion + Episodes API

**Sprint Duration:** 2 weeks (10 working days)  
**Start Date:** 2026-05-01  
**End Date:** 2026-05-15  
**Team:** agentBE (Backend), agentUI (Frontend Integration)

---

## 🎯 Sprint Goals

### Primary Goal (MUST HAVE)
1. ✅ **RAG Ingestion Pipeline** — Foundation cho Knowledge Agent
2. ✅ **Episodes API** — Worklist functionality

### Secondary Goal (NICE TO HAVE)
3. ⏳ **Upload API** — Image upload preparation (nếu còn thời gian)

---

## 📋 Phân Tích Ưu Tiên

### Tại sao RAG Ingestion đầu tiên?
- **Blocker:** Knowledge Agent hiện tại dùng text search (không có embeddings)
- **Impact:** HIGH — Foundation cho toàn bộ RAG system
- **Effort:** 5-7 giờ (1-2 ngày)
- **Dependencies:** Không phụ thuộc vào features khác
- **Risk:** LOW — Ollama đã sẵn sàng, database schema có sẵn

### Tại sao Episodes API thứ hai?
- **Blocker:** Worklist page đang dùng mock data
- **Impact:** HIGH — Core workflow (80% user interactions)
- **Effort:** 3-5 ngày
- **Dependencies:** Cần RAG Ingestion xong để test end-to-end
- **Risk:** MEDIUM — Cần thiết kế status workflow

### Tại sao Upload API để sau?
- **Blocker:** Upload page đang dùng mock
- **Impact:** MEDIUM — Chỉ dùng khi tạo case mới
- **Effort:** 2-3 ngày
- **Dependencies:** Cần Episodes API + PCXR model (đang train)
- **Risk:** HIGH — PCXR model chưa sẵn sàng

---

## 🗓️ Timeline Chi Tiết

### Week 1 (Days 1-5)

#### **Day 1-2: RAG Ingestion Pipeline**
**Owner:** agentBE  
**Effort:** 1-2 days

**Tasks:**
- [x] Step 1: Environment setup (Ollama nomic-embed-text)
- [ ] Step 2-5: Foundation (types, parser, chunker, tokenizer)
- [ ] Step 6-7: Embeddings (client, batch processor)
- [ ] Step 8-9: Integration (service, CLI tool)
- [ ] Step 10: Update Knowledge Agent (vector search)
- [ ] Test: Ingest 2 PDFs, verify vector search

**Success Criteria:**
- ✅ 2 PDFs ingested (PERCH + VinDr)
- ✅ Database có ~70 chunks với embeddings (768 dims)
- ✅ Vector search hoạt động (match_chunks)
- ✅ Knowledge Agent trả về citations từ ingested docs
- ✅ Query latency < 3s

**Deliverables:**
- 8 files mới (ingestion pipeline)
- 2 files sửa (knowledge.ts, package.json)
- CLI tool: `yarn ingest --file X.pdf`

---

#### **Day 3-5: Episodes API (Part 1)**
**Owner:** agentBE  
**Effort:** 3 days

**Tasks:**
- [ ] Design database schema updates (nếu cần)
- [ ] Create `/api/episodes` route
  - [ ] GET `/api/episodes` — List với pagination
  - [ ] GET `/api/episodes/:id` — Get single episode
  - [ ] POST `/api/episodes` — Create new episode
  - [ ] PATCH `/api/episodes/:id` — Update status
- [ ] Add RBAC permissions (`episodes:read`, `episodes:create`, `episodes:update`)
- [ ] Seed test data (5-10 episodes)
- [ ] Write API tests

**Success Criteria:**
- ✅ GET `/api/episodes` returns paginated list
- ✅ Status filtering works (`?status=pending_explain`)
- ✅ RBAC enforced (clinician can read, admin can update)
- ✅ Audit logging enabled
- ✅ Response time < 500ms

**Deliverables:**
- `apps/api/src/routes/episodes.ts`
- `apps/api/src/controllers/episodes.ts`
- Database seed script
- API documentation

---

### Week 2 (Days 6-10)

#### **Day 6-7: Episodes API (Part 2) + Frontend Integration**
**Owner:** agentBE (Day 6), agentUI (Day 7)  
**Effort:** 2 days

**agentBE Tasks (Day 6):**
- [ ] Implement status workflow logic
  - [ ] `pending_detection` → `pending_explain` → `pending_draft` → `pending_approval` → `completed`
  - [ ] Validate status transitions
- [ ] Add polling endpoint: GET `/api/episodes/:id/status`
- [ ] Optimize queries (indexes, caching)
- [ ] Deploy to staging

**agentUI Tasks (Day 7):**
- [ ] Replace mock data với real API
- [ ] Update `apps/web/src/lib/api/episodes.ts`
- [ ] Handle loading states
- [ ] Handle errors (401, 403, 500)
- [ ] Test với 4 user roles
- [ ] Verify polling works

**Success Criteria:**
- ✅ Worklist page loads real data
- ✅ Status filtering works in UI
- ✅ Polling updates status automatically
- ✅ Role-based UI rendering works
- ✅ No console errors

---

#### **Day 8-10: Buffer + Upload API Prep (Optional)**
**Owner:** agentBE  
**Effort:** 2-3 days (if time permits)

**Tasks (if RAG + Episodes done early):**
- [ ] Setup Supabase Storage bucket
- [ ] Create presigned URL endpoint
- [ ] POST `/api/episodes/upload` route (basic)
- [ ] File validation (size, type)
- [ ] Store metadata in database

**Tasks (if no time):**
- [ ] Bug fixes
- [ ] Performance optimization
- [ ] Documentation
- [ ] Code review

---

## 🔧 Technical Decisions

### 1. Queue System (for PCXR Detection)
**Decision:** ⏳ DEFER to Phase 2  
**Reason:** PCXR model đang train, không cần queue ngay

**Options:**
- A. BullMQ (Redis-based) — Best for production
- B. Supabase Edge Functions — Serverless, no infra
- C. Simple polling — MVP approach

**Recommendation:** Option C cho MVP, migrate to A sau

---

### 2. File Storage
**Decision:** ✅ Supabase Storage  
**Reason:** Đã có Supabase, tích hợp dễ, RLS built-in

**Implementation:**
```typescript
// Bucket: medical-images
// Path: {user_id}/{episode_id}/{filename}
// Access: Private (RLS policies)
```

---

### 3. Embedding Model
**Decision:** ✅ Ollama nomic-embed-text (768 dims)  
**Reason:** Local, free, đã có Ollama setup

**Alternatives considered:**
- OpenAI text-embedding-3-small (1536 dims) — Cost money
- Sentence Transformers — Cần setup riêng

---

### 4. Status Workflow
**Decision:** ✅ Linear workflow với validation

**Flow:**
```
pending_detection → pending_explain → pending_draft → pending_approval → completed
                                                    ↓
                                                rejected (loop back)
```

**Rules:**
- Chỉ admin/radiologist có thể approve
- Clinician có thể draft nhưng không approve
- Researcher chỉ read-only

---

## 📊 Effort Summary

| Task | Owner | Effort | Priority |
|------|-------|--------|----------|
| RAG Ingestion | agentBE | 1-2 days | HIGH |
| Episodes API (Backend) | agentBE | 3-5 days | HIGH |
| Episodes Integration (Frontend) | agentUI | 1 day | HIGH |
| Upload API Prep | agentBE | 2-3 days | MEDIUM |
| **Total** | | **7-11 days** | |

**Buffer:** 3 days (for bugs, testing, documentation)

---

## 🚀 Rollout Plan

### Day 1-2: RAG Ingestion
```bash
# agentBE
1. Pull nomic-embed-text
2. Install dependencies (yarn add pdf-parse tiktoken...)
3. Create 8 files (types, parser, chunker, embedding, service, CLI)
4. Test: yarn ingest --file knowledge_base/downloads/03_PERCH_study.pdf
5. Verify: psql -c "SELECT COUNT(*) FROM chunks;"
6. Update Knowledge Agent (vector search)
7. Test: curl -X POST /api/query -d '{"query": "WHO criteria?"}'
```

### Day 3-5: Episodes API
```bash
# agentBE
1. Create routes/episodes.ts
2. Create controllers/episodes.ts
3. Add RBAC permissions
4. Seed test data
5. Test: curl -X GET /api/episodes
6. Deploy to staging
```

### Day 6-7: Integration
```bash
# agentBE (Day 6)
1. Add status workflow logic
2. Add polling endpoint
3. Optimize queries

# agentUI (Day 7)
1. Update lib/api/episodes.ts
2. Replace mock data
3. Test with 4 roles
4. Verify polling
```

### Day 8-10: Buffer
```bash
# agentBE
1. Bug fixes
2. Performance tuning
3. Documentation
4. Code review
```

---

## ✅ Success Metrics

### RAG Ingestion
- [ ] 2 PDFs ingested successfully
- [ ] Vector search returns relevant results
- [ ] Query latency < 3s
- [ ] Citations accurate

### Episodes API
- [ ] GET /api/episodes returns data
- [ ] Status filtering works
- [ ] RBAC enforced correctly
- [ ] Response time < 500ms
- [ ] Audit logs captured

### Frontend Integration
- [ ] Worklist loads real data
- [ ] Polling updates status
- [ ] Role-based UI works
- [ ] No console errors
- [ ] Loading states smooth

---

## 🔗 Dependencies

### External Dependencies
- ✅ Ollama server (A100) — Ready
- ✅ Supabase database — Ready
- ✅ Test users — Ready (4 users)
- ⏳ PCXR model — Training (not needed for Phase 1)

### Internal Dependencies
- RAG Ingestion → Episodes API (test end-to-end)
- Episodes API → Frontend Integration
- Upload API → PCXR model (defer to Phase 2)

---

## 🚨 Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Ollama connection timeout | HIGH | LOW | Retry logic, fallback to mock |
| PDF parsing quality low | MEDIUM | MEDIUM | Manual review, adjust chunking |
| Status workflow complex | MEDIUM | MEDIUM | Start simple, iterate |
| PCXR model not ready | HIGH | HIGH | Use mock detection (already planned) |
| Time overrun | MEDIUM | MEDIUM | 3-day buffer, defer Upload API |

---

## 📝 Communication Plan

### Daily Standups (in chat2.md)
- agentBE: Log progress mỗi ngày
- agentUI: Log blockers nếu có
- agentFE: Review và unblock

### Format:
```
[2026-05-XX HH:MM] agentBE → ALL
[DAILY UPDATE] Day X/10

Completed:
- Task A
- Task B

In Progress:
- Task C (50% done)

Blockers:
- None / Issue X

Next:
- Task D
```

---

## 🎯 Phase 2 Preview (Sprint 2)

**After Phase 1 complete:**
1. Upload API + PCXR Detection (7-9 days)
2. Knowledge Base API (9-11 days)
3. Admin API (2.5-3.5 days)

**Total Phase 2:** ~20-24 days

---

## 📚 References

- Backend Integration Gaps: `note/agent_chat/BACKEND_INTEGRATION_GAPS.md`
- RAG Ingestion Plan: `_docs/technical/RAG_INGESTION_IMPLEMENTATION_PLAN.md`
- Database Schema: `packages/db/src/migrations/001_initial_schema.sql`
- API Endpoints: `apps/api/src/routes/`

---

**Status:** 📋 Plan Ready — Awaiting agentBE to start Day 1  
**Next Action:** agentBE bắt đầu RAG Ingestion Step 1  
**Approval:** User approved RAG Ingestion priority

---

**END OF SPRINT PLAN**
