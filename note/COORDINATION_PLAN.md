---
noteId: "coordination-plan-20260502"
tags: ["coordination", "planning", "team"]
created: 2026-05-02T05:56:00Z
author: agentFE (Coordinator)
---

# 📋 DỰ ÁN RAG_BVNHIDONG - KẾ HOẠCH ĐIỀU PHỐI

**Coordinator:** agentFE (Kiro)  
**Team:** FE (Frontend), BE1 (Backend Core), BE2 (Backend Features)  
**Ngày tạo:** 02/05/2026 05:56  
**Sprint hiện tại:** Phase 1 - Week 1

---

## 🎯 TỔNG QUAN DỰ ÁN

### Mục tiêu
Xây dựng hệ thống RAG (Retrieval Augmented Generation) hỗ trợ chẩn đoán viêm phổi cho Bệnh viện Nhi Đồng.

### Tech Stack
- **Frontend:** Next.js 14 + TypeScript + Tailwind CSS + Framer Motion
- **Backend:** Express.js + TypeScript + Supabase + Ollama
- **Database:** PostgreSQL (Supabase) + pgvector
- **AI/ML:** Ollama (qwen2.5:7b, nomic-embed-text), PCXR model (đang train)

---

## 📊 TRẠNG THÁI HIỆN TẠI (02/05/2026)

### ✅ ĐÃ HOÀN THÀNH (100%)

#### **1. Authentication System**
- ✅ Supabase Auth integration (SSR)
- ✅ JWT validation middleware
- ✅ RBAC với 4 roles: admin, clinician, radiologist, researcher
- ✅ Login/Logout flow
- ✅ Protected routes middleware
- ✅ 4 test users đã tạo (password: Test1234!)

#### **2. Backend Core API (20 files, ~2,500 LOC)**
- ✅ Server running: http://localhost:3005
- ✅ 3 AI Agents: Knowledge, Explainer, Reporter
- ✅ 3 API endpoints: `/api/query`, `/api/explain`, `/api/draft`
- ✅ Middleware stack: Auth + RBAC + Guardrails + Audit
- ✅ File logging system (Winston)
- ✅ Database: 9 tables created

#### **3. Frontend UI (Mock Data)**
- ✅ Worklist page (3-step flow)
- ✅ Upload page (drag & drop)
- ✅ Case Detail page (detection → explain → draft)
- ✅ Animation system Phase 1-2
- ✅ Zoom-to-bbox feature
- ✅ Role-based UI rendering

#### **4. RAG Ingestion Pipeline (CODE COMPLETE)**
- ✅ 10 files created (PDF parser, chunker, embedding client, CLI tool)
- ✅ Code hoàn chỉnh, chờ test
- ⏳ **CHƯA TEST** (chờ pull model + run migration)

---

### ⏳ ĐANG CHỜ (BLOCKERS)

#### **RAG Ingestion - Chờ Setup:**
1. ⏳ Pull model `nomic-embed-text` trên A100
2. ⏳ Chạy SQL migration: `create-vector-search-function.sql`
3. ⏳ Test ingestion với 2 PDFs (PERCH + VinDr)

---

### ❌ CHƯA LÀM (PHASE 1 - HIGH PRIORITY)

#### **1. Episodes API** (3-5 days)
**Mục đích:** Backend cho Worklist page  
**Endpoints cần tạo:**
- GET `/api/episodes` - List với pagination
- GET `/api/episodes/:id` - Single episode
- POST `/api/episodes` - Create episode
- PATCH `/api/episodes/:id` - Update status
- GET `/api/episodes/:id/status` - Polling endpoint

**RBAC:**
- clinician: read, create
- radiologist: read, create, approve
- researcher: read
- admin: all

**Effort:** 3-5 days (BE1 hoặc BE2)

---

#### **2. Upload API** (2-3 days)
**Mục đích:** Backend cho Upload page  
**Features:**
- Image upload (Supabase Storage)
- Presigned URLs
- File validation
- Mock PCXR detection (model chưa sẵn sàng)

**Effort:** 2-3 days (BE1 hoặc BE2)

---

## 👥 PHÂN CÔNG TEAM

### **Kiro (agentFE - Coordinator/Điều phối viên)**
**Vai trò:**
- Điều phối toàn bộ dự án
- Review code và architecture
- Unblock các vấn đề
- Quản lý sprint planning
- Communication hub
- **KHÔNG code** - chỉ điều phối

**Nhiệm vụ hàng ngày:**
- Review daily updates từ FE, BE1, BE2
- Prioritize tasks
- Resolve conflicts
- Update sprint progress
- Code review
- Unblock issues

---

### **FE (Frontend Developer - agentUI)**
**Vai trò:** Implement và maintain Next.js frontend

**Nhiệm vụ hiện tại:**
1. ⏳ **Tiếp tục Animation Expansion** (không block)
   - Apply animations cho 17/20 components còn lại
   - Estimated: 2-3 days
   
2. ⏳ **Chờ Episodes API** (từ BE1/BE2)
   - Sau khi API xong → integrate vào Worklist
   - Replace mock data với real API calls
   - Estimated: 1 day integration

**Nhiệm vụ tiếp theo:**
3. Upload API integration (sau khi BE xong)
4. Case Detail API integration

---

### **BE1 (Backend Core Developer - agentBE)**
**Vai trò:** Core backend features, RAG pipeline, AI agents

**Nhiệm vụ hiện tại:**
1. 🔴 **HIGH PRIORITY: Test RAG Ingestion Pipeline**
   - Pull `nomic-embed-text` model trên A100
   - Run SQL migration
   - Test ingest 2 PDFs
   - Verify vector search hoạt động
   - **Estimated:** 2-3 hours
   - **Blocker:** Cần access A100 server

2. 🔴 **HIGH PRIORITY: Episodes API** (sau khi RAG test xong)
   - Implement 5 endpoints
   - Add RBAC permissions
   - Seed test data
   - Write tests
   - **Estimated:** 3-5 days

**Nhiệm vụ tiếp theo:**
3. Knowledge Base API (Phase 2)
4. Multi-LLM Racing (Phase 2)

---

### **BE2 (Backend Features Developer - Chưa assign)**
**Vai trò:** Feature APIs, integrations, utilities

**Nhiệm vụ hiện tại:**
1. 🟡 **MEDIUM PRIORITY: Upload API Prep**
   - Setup Supabase Storage
   - Presigned URL endpoint
   - File validation
   - Mock PCXR detection
   - **Estimated:** 2-3 days
   - **Có thể bắt đầu song song với BE1**

**Nhiệm vụ tiếp theo:**
2. Admin API (user management, audit logs)
3. Document Management API

---

## 📅 SPRINT TIMELINE (Phase 1 - 10 days)

### **Week 1 (Day 1-5)**

#### **Day 1-2: RAG Testing + Episodes API Start**
- **BE1:** Test RAG pipeline (2-3h) → Start Episodes API
- **BE2:** Start Upload API prep
- **FE:** Continue animations

#### **Day 3-5: Episodes API Development**
- **BE1:** Episodes API implementation (endpoints + RBAC)
- **BE2:** Upload API implementation
- **FE:** Finish animations, prepare for API integration

---

### **Week 2 (Day 6-10)**

#### **Day 6-7: Episodes API Complete + Frontend Integration**
- **BE1:** Finish Episodes API, write tests
- **BE2:** Finish Upload API
- **FE:** Integrate Episodes API vào Worklist

#### **Day 8-10: Testing + Buffer**
- **ALL:** End-to-end testing
- **BE1/BE2:** Bug fixes
- **FE:** Polish UI, handle edge cases

---

## 🔄 COMMUNICATION PROTOCOL

### **Daily Updates (in chat2.md)**
Mỗi agent ghi log hàng ngày:

```
[2026-05-XX HH:MM] <AGENT_NAME> → ALL
[DAILY UPDATE] Day X/10

✅ Completed:
- Task A
- Task B

🔄 In Progress:
- Task C (50% done)

🚫 Blockers:
- None / Issue X

📋 Next:
- Task D

⏱️ Estimated completion: X days
```

### **Blocker Protocol**
Nếu gặp blocker:
1. Ghi log với tag `[BLOCKER]`
2. Ping @agentFE
3. Đính kèm error message/context
4. Đề xuất giải pháp (nếu có)

### **Code Review**
- Mỗi feature hoàn thành → ping agentFE review
- agentFE sẽ review trong 2-4 giờ
- Feedback qua chat2.md

---

## 🎯 SUCCESS CRITERIA (Phase 1)

### **Must Have (Week 1-2)**
- ✅ RAG Ingestion tested và hoạt động
- ✅ Episodes API hoàn chỉnh (5 endpoints)
- ✅ Worklist page dùng real data
- ✅ Upload API ready (mock PCXR)

### **Nice to Have**
- ⏳ Animation expansion complete (20/20 components)
- ⏳ Upload page integrated với backend

### **Quality Gates**
- ✅ All endpoints có authentication
- ✅ RBAC enforced
- ✅ Audit logging enabled
- ✅ Response time < 3s
- ✅ No console errors
- ✅ TypeScript strict mode

---

## 📊 METRICS & TRACKING

### **Velocity Tracking**
- Estimated: 10 days
- Buffer: 3 days
- Total: 13 days (2.6 weeks)

### **Daily Checklist**
- [ ] Day 1: RAG test complete
- [ ] Day 2: Episodes API started
- [ ] Day 3: Episodes API 50%
- [ ] Day 4: Episodes API 80%
- [ ] Day 5: Episodes API complete
- [ ] Day 6: Upload API complete
- [ ] Day 7: Frontend integration
- [ ] Day 8-10: Testing & polish

---

## 🚨 RISKS & MITIGATION

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| A100 access delayed | HIGH | MEDIUM | BE1 làm Episodes API trước, test RAG sau |
| PCXR model không sẵn sàng | MEDIUM | HIGH | Dùng mock detection (đã plan) |
| Episodes API phức tạp hơn dự kiến | MEDIUM | MEDIUM | 3-day buffer, defer Upload API |
| Frontend integration issues | LOW | LOW | API client đã sẵn sàng |

---

## 📚 DOCUMENTS REFERENCE

### **Technical Docs**
- `BACKEND_INTEGRATION_GAPS.md` - Gap analysis
- `RAG_INGESTION_IMPLEMENTATION_PLAN.md` - RAG spec
- `SPRINT_PLAN_PHASE1.md` - Sprint details
- `TASK_ASSIGNMENT_BE.md` - BE tasks

### **Communication**
- `note/agent_chat/chat1.md` - History (đã đầy)
- `note/agent_chat/chat2.md` - Current log
- `note/agent_chat/BACKEND_INTEGRATION_GAPS.md` - Gap analysis

### **Code**
- Frontend: `apps/web/`
- Backend: `apps/api/`
- Database: `apps/api/src/lib/supabase/schema.sql`

---

## 🎯 NEXT ACTIONS (IMMEDIATE)

### **BE1 (URGENT):**
1. Xác nhận access A100 server
2. Pull `nomic-embed-text` model
3. Run SQL migration
4. Test RAG ingestion
5. Report kết quả trong chat2.md

### **BE2:**
1. Đọc `BACKEND_INTEGRATION_GAPS.md` section Upload API
2. Setup Supabase Storage bucket
3. Tạo presigned URL endpoint
4. Report progress trong chat2.md

### **FE:**
1. Tiếp tục Animation Expansion
2. Prepare API integration code (lib/api/episodes.ts)
3. Report progress trong chat2.md

### **agentFE (Kiro):**
1. Monitor daily updates
2. Unblock BE1 nếu không access được A100
3. Review code khi có PR
4. Update sprint progress

---

## 📞 CONTACT & ESCALATION

**For Blockers:**
- Tag `@agentFE` trong chat2.md
- Response time: < 2 hours

**For Technical Questions:**
- Post trong chat2.md với tag `[QUESTION]`
- agentFE hoặc team member sẽ trả lời

**For Urgent Issues:**
- Tag `[URGENT]` trong chat2.md
- agentFE sẽ prioritize ngay

---

**Status:** 📋 Coordination Plan Ready  
**Next Update:** Daily (in chat2.md)  
**Sprint End:** 2026-05-15

---

**END OF COORDINATION PLAN**
