---
noteId: "326cd410457111f1b3ce19fa7351e6bb"
tags: []

---

# TASK ASSIGNMENT — agentBE

**Date:** 2026-05-01  
**Assignee:** agentBE  
**Status:** PENDING START

---

## 🎯 Nhiệm vụ chính (Tuần 1-2)

### **Task 1: RAG Ingestion Pipeline** (1-2 ngày)
**Priority:** 🔴 HIGH — Bắt đầu ngay
**Plan:** `_docs/technical/RAG_INGESTION_IMPLEMENTATION_PLAN.md`

**Checklist:**
- [ ] Step 1: Pull `nomic-embed-text` trên A100
- [ ] Step 1: Install deps (yarn add pdf-parse tiktoken marked...)
- [ ] Step 2-10: Implement pipeline
- [ ] Test: Ingest 2 PDFs
- [ ] Verify: Vector search hoạt động

**Success:** Database có ~70 chunks với embeddings (768 dims)

---

### **Task 2: Episodes API** (3-5 ngày)
**Priority:** 🔴 HIGH — Sau khi Task 1 xong
**Design:** Tự design theo BACKEND_INTEGRATION_GAPS.md

**Endpoints cần tạo:**
- [ ] GET `/api/episodes` — List với pagination
- [ ] GET `/api/episodes/:id` — Single episode
- [ ] POST `/api/episodes` — Create episode
- [ ] PATCH `/api/episodes/:id` — Update status
- [ ] GET `/api/episodes/:id/status` — Polling endpoint

**RBAC:**
- clinician: read, create
- radiologist: read, create, approve
- researcher: read
- admin: read, create, update, approve

**Success:** API trả về data thật, status filtering hoạt động

---

### **Task 3: Upload API Prep** (2-3 ngày, nếu còn thời gian)
**Priority:** 🟡 MEDIUM
**Design:** Xem BACKEND_INTEGRATION_GAPS.md

**Tasks:**
- [ ] Setup Supabase Storage
- [ ] Presigned URL endpoint
- [ ] File validation
- [ ] Metadata storage

**Success:** Upload-ready (nhưng không có PCXR detection vì model đang train)

---

## 📝 Ghi chú

- ✅ Dùng **YARN**, không dùng npm
- ✅ Ollama đã có trên A100 (remote)
- ✅ Database schema sẵn sàng
- ⏳ PCXR model đang train (dùng mock)

---

## 🚨 Blockers

Nếu gặp vấn đề:
1. Ghi log vào chat2.md với tag [BLOCKER]
2. Ping agentFE
3. Đính kèm error message

---

**Status:** Ready to start  
**Next:** Đọc RAG_INGESTION_IMPLEMENTATION_PLAN.md và bắt đầu Step 1
