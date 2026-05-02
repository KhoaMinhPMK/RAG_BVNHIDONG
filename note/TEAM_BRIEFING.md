---
noteId: "team-briefing-20260502"
tags: ["briefing", "team", "quick-start"]
created: 2026-05-02T05:58:00Z
---

# 🚀 TEAM BRIEFING - DỰ ÁN RAG_BVNHIDONG

**Ngày:** 02/05/2026  
**Coordinator:** agentFE (Kiro)  
**Team:** FE, BE1, BE2

---

## 📌 TÓM TẮT NHANH (60 GIÂY)

### Dự án là gì?
Hệ thống RAG hỗ trợ chẩn đoán viêm phổi cho Bệnh viện Nhi Đồng.

### Đã làm được gì?
- ✅ Authentication system (100%)
- ✅ Backend API với 3 AI agents (100%)
- ✅ Frontend UI với mock data (100%)
- ✅ RAG Ingestion code (100%, chưa test)

### Cần làm gì tiếp?
1. **BE1:** Test RAG pipeline → Làm Episodes API
2. **BE2:** Làm Upload API
3. **FE:** Animations → Integrate APIs

### Timeline?
**10 ngày** (2 tuần) cho Phase 1

---

## 👥 TEAM ROLES

### **Kiro (agentFE) - Coordinator/Điều phối viên**
- Điều phối dự án
- Review code
- Unblock issues
- Daily check-ins
- **KHÔNG code** - chỉ điều phối

### **FE (agentUI) - Frontend Developer**
- Next.js frontend
- Animations
- API integration

### **BE1 (agentBE) - Backend Core**
- RAG pipeline
- Episodes API
- AI agents

### **BE2 (Chưa assign) - Backend Features**
- Upload API
- Admin features
- Integrations

---

## 🎯 NHIỆM VỤ NGAY BÂY GIỜ

### **BE1 (URGENT - Bắt đầu ngay)**
```bash
# Task 1: Test RAG Ingestion (2-3 giờ)
1. SSH vào A100 server
2. Pull model: ollama pull nomic-embed-text
3. Verify: ollama list | grep nomic-embed-text
4. Run SQL: apps/api/supabase-migrations/create-vector-search-function.sql
5. Test ingest: cd apps/api && npx tsx src/scripts/ingest-documents.ts <pdf-path>
6. Report kết quả trong chat2.md

# Task 2: Episodes API (3-5 ngày, sau khi Task 1 xong)
- Đọc: BACKEND_INTEGRATION_GAPS.md (section Episodes API)
- Implement 5 endpoints
- Add RBAC
- Seed data
```

**Blocker?** Không access A100 → Ping @agentFE ngay

---

### **BE2 (Có thể bắt đầu song song)**
```bash
# Task: Upload API (2-3 ngày)
1. Đọc: BACKEND_INTEGRATION_GAPS.md (section Upload API)
2. Setup Supabase Storage bucket
3. Create presigned URL endpoint: POST /api/upload/presigned
4. File validation middleware
5. Mock PCXR detection endpoint
6. Report progress trong chat2.md
```

**Documents:**
- `BACKEND_INTEGRATION_GAPS.md` - Lines 94-195 (Upload API section)
- `apps/api/README.md` - API structure

---

### **FE (Continue current work)**
```bash
# Task 1: Animation Expansion (2-3 ngày)
- Apply animations cho 17/20 components còn lại
- Follow: UI_ANIMATION_EXPANSION.md

# Task 2: Prepare API Integration (1 ngày)
- Create: apps/web/src/lib/api/episodes.ts
- Types: Episode, EpisodeStatus, EpisodeFilters
- Functions: getEpisodes(), getEpisode(), createEpisode(), updateEpisode()

# Task 3: Wait for BE1 Episodes API
- Integrate khi API xong
```

**Documents:**
- `UI_ANIMATION_EXPANSION.md` - Animation plan
- `apps/web/src/lib/api/client.ts` - API client pattern

---

## 📝 DAILY UPDATES

**Mỗi ngày ghi log vào `chat2.md`:**

```
[2026-05-XX HH:MM] <TÊN_BẠN> → ALL
[DAILY UPDATE] Day X/10

✅ Completed:
- Task A done
- Task B done

🔄 In Progress:
- Task C (50% done)

🚫 Blockers:
- None / Issue X

📋 Next:
- Task D tomorrow

⏱️ Estimated: X days remaining
```

---

## 🚨 KHI GẶP VẤN ĐỀ

### Blocker (không làm tiếp được)
```
[2026-05-XX HH:MM] <TÊN_BẠN> → @agentFE
[BLOCKER] Cannot access A100 server

Error: Connection timeout
Tried: ssh user@server (failed)
Need: VPN credentials or alternative access

@agentFE please help!
```

### Question (cần clarification)
```
[2026-05-XX HH:MM] <TÊN_BẠN> → ALL
[QUESTION] Episodes API - Status workflow

Should status transition be:
A) pending_detection → pending_explain → pending_draft → completed
B) Allow skip steps?

@agentFE please advise
```

### Code Review (feature xong)
```
[2026-05-XX HH:MM] <TÊN_BẠN> → @agentFE
[REVIEW REQUEST] Episodes API complete

Files changed:
- apps/api/src/routes/episodes.ts (new)
- apps/api/src/controllers/episodes.ts (new)
- 5 endpoints implemented
- Tests passing

@agentFE please review
```

---

## 📚 DOCUMENTS QUAN TRỌNG

### **Phải đọc trước khi bắt đầu:**
1. `COORDINATION_PLAN.md` - Kế hoạch tổng thể
2. `BACKEND_INTEGRATION_GAPS.md` - Features cần làm
3. `chat2.md` - Communication log

### **Đọc khi làm task cụ thể:**
- **RAG Ingestion:** `RAG_INGESTION_IMPLEMENTATION_PLAN.md`
- **Episodes API:** `BACKEND_INTEGRATION_GAPS.md` (lines 43-90)
- **Upload API:** `BACKEND_INTEGRATION_GAPS.md` (lines 94-195)
- **Animations:** `UI_ANIMATION_EXPANSION.md`

### **Reference:**
- **Backend:** `apps/api/README.md`
- **Frontend:** `apps/web/TEST_USERS.md`
- **Database:** `apps/api/src/lib/supabase/schema.sql`

---

## 🎯 SUCCESS CRITERIA (Phase 1)

### Week 1 (Day 1-5)
- [ ] RAG Ingestion tested và hoạt động
- [ ] Episodes API 80% complete
- [ ] Upload API 50% complete
- [ ] Animations 80% complete

### Week 2 (Day 6-10)
- [ ] Episodes API 100% + tests
- [ ] Upload API 100% + tests
- [ ] Frontend integration complete
- [ ] End-to-end testing passed

---

## 🔗 QUICK LINKS

### **Servers:**
- Frontend: http://localhost:3000 (Next.js)
- Backend: http://localhost:3005 (Express)
- Supabase: https://mibtdruhmmcatccdzjjk.supabase.co
- A100 Ollama: (via Cloudflare Tunnel)

### **Test Accounts:**
- admin@bvnhidong.vn / Test1234!
- clinician@bvnhidong.vn / Test1234!
- radiologist@bvnhidong.vn / Test1234!
- researcher@bvnhidong.vn / Test1234!

### **Commands:**
```bash
# Frontend
cd apps/web
yarn dev

# Backend
cd apps/api
yarn dev

# RAG Ingestion
cd apps/api
npx tsx src/scripts/ingest-documents.ts <path>
```

---

## ⏱️ TIMELINE OVERVIEW

```
Day 1-2:  RAG Testing + Start APIs
Day 3-5:  Develop APIs
Day 6-7:  Complete APIs + Frontend Integration
Day 8-10: Testing + Polish
```

---

## 📞 CONTACT

**Coordinator:** agentFE (Kiro)  
**Response time:** < 2 hours  
**Communication:** `note/agent_chat/chat2.md`

---

**🚀 LET'S BUILD! 🚀**

**Next:** Check in vào chat2.md và bắt đầu tasks của bạn!
