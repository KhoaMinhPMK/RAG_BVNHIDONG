---
noteId: "team-communication-protocol"
tags: ["communication", "teamwork", "protocol", "rules"]
created: 2026-05-02T08:15:00Z
priority: CRITICAL
---

# 📢 QUY TẮC LÀM VIỆC NHÓM & COMMUNICATION PROTOCOL

**Ngày tạo:** 02/05/2026 08:15  
**Người tạo:** Kiro (agentFE - Coordinator)  
**Áp dụng cho:** FE, BE1, BE2, ALL AGENTS  
**Status:** 🔴 MANDATORY - BẮT BUỘC TUÂN THỦ

---

## 🎯 NGUYÊN TẮC CỐT LÕI

### **1. LUÔN LUÔN GHI VÀO CHAT**
**Mọi thông tin, mọi hành động, mọi vấn đề → GHI VÀO CHAT2.MD**

### **2. KHÔNG BAO GIỜ LÀM VIỆC IM LẶNG**
**Nếu không ai biết bạn đang làm gì → Bạn không làm gì cả**

### **3. COORDINATOR ĐỌC CHAT ĐỂ HỖ TRỢ**
**Kiro (agentFE) đọc chat liên tục để unblock, hỗ trợ, điều phối**

---

## 📋 QUY TẮC BẮT BUỘC

### **Rule 1: BẮT ĐẦU TASK → GHI NGAY**
```
[TIME] AGENT → ALL
[START] Task X - <Task Name>

📋 Mục tiêu: <what>
⏱️ ETA: <time>
📁 Files: <files will touch>
```

**Ví dụ:**
```
[2026-05-02 08:20] BE1 → ALL
[START] Task 3.5 - Integration Testing & Migration

📋 Mục tiêu: Run migration + start server + test APIs
⏱️ ETA: 30 phút
📁 Files: 002_episodes_enhancement.sql, apps/api/src/index.ts
```

---

### **Rule 2: GẶP LỖI → BÁO NGAY**
```
[TIME] AGENT → ALL
[ERROR] Task X - <Error Summary>

❌ Lỗi: <error message>
📍 Location: <file:line>
🔍 Đã thử: <what you tried>
❓ Cần: <what you need>

@agentFE: Vui lòng hỗ trợ
```

**Ví dụ:**
```
[2026-05-02 08:25] BE1 → ALL
[ERROR] Task 3.5 - Migration Failed

❌ Lỗi: relation "episodes" already exists
📍 Location: 002_episodes_enhancement.sql:15
🔍 Đã thử: DROP TABLE IF EXISTS (không work)
❓ Cần: Hướng dẫn rollback migration

@agentFE: Vui lòng hỗ trợ
```

---

### **Rule 3: CẦN GÌ → HỎI NGAY**
```
[TIME] AGENT → ALL
[QUESTION] Task X - <Question>

❓ Câu hỏi: <your question>
🎯 Context: <why you need this>
⏱️ Urgent: Yes/No

@agentFE: Vui lòng trả lời
```

**Ví dụ:**
```
[2026-05-02 08:30] FE → ALL
[QUESTION] Task 4 - Backend URL

❓ Câu hỏi: Backend đang chạy port nào? 3005 hay 3001?
🎯 Context: Cần config API_BASE_URL trong .env
⏱️ Urgent: Yes (blocking integration test)

@agentFE: Vui lòng xác nhận
```

---

### **Rule 4: HOÀN THÀNH → BÁO NGAY**
```
[TIME] AGENT → ALL
[DONE] Task X - <Task Name>

✅ Đã làm: <what you did>
📊 Kết quả: <results>
📁 Files: <files changed>
🔗 Related: <links to docs/PRs>
📋 Next: <what's next>
```

**Ví dụ:**
```
[2026-05-02 08:50] BE1 → ALL
[DONE] Task 3.5 - Integration Testing & Migration

✅ Đã làm:
- Migration 002 executed successfully
- Backend server running on port 3005
- Tested 3 endpoints (all working)

📊 Kết quả:
- GET /api/episodes: 200 OK (5 episodes)
- GET /api/episodes/:id: 200 OK
- POST /api/episodes: 201 Created

📁 Files: 002_episodes_enhancement.sql (executed)
🔗 Server: http://localhost:3005
📋 Next: Continue Task 3 (Detection API)

@FE: Server ready, bắt đầu Task 4 được rồi
```

---

### **Rule 5: PROGRESS UPDATE MỖI 30 PHÚT**
```
[TIME] AGENT → ALL
[UPDATE] Task X - Progress

✅ Done: <what's done>
🔄 Doing: <what you're doing now>
⏱️ Progress: X%
🚫 Blockers: None / <blocker>
📋 Next: <next step>
⏱️ ETA: <time remaining>
```

**Ví dụ:**
```
[2026-05-02 09:00] BE2 → ALL
[UPDATE] Task 1.2 - RAG Testing Progress

✅ Done: tsx installed, environment ready
🔄 Doing: Testing ingestion với main.pdf
⏱️ Progress: 60%
🚫 Blockers: None
📋 Next: Verify database, test vector search
⏱️ ETA: 20 phút
```

---

### **Rule 6: BLOCKER → ESCALATE NGAY**
```
[TIME] AGENT → ALL
[BLOCKER] Task X - <Blocker Summary>

🚫 Blocker: <what's blocking>
⏱️ Blocked since: <time>
🔍 Đã thử: <what you tried>
💡 Đề xuất: <your suggestion>
⚠️ Impact: <impact on timeline>

@agentFE: URGENT - Cần unblock
```

**Ví dụ:**
```
[2026-05-02 09:15] BE2 → ALL
[BLOCKER] Task 1.2 - A100 Connection Failed

🚫 Blocker: Cannot SSH to A100 server
⏱️ Blocked since: 09:00 (15 phút)
🔍 Đã thử:
- ssh user@a100-server (connection timeout)
- ping a100-server (no response)
- Check VPN (connected)
💡 Đề xuất: Request new credentials hoặc use local GPU
⚠️ Impact: Cannot test RAG, block toàn bộ AI pipeline

@agentFE: URGENT - Cần unblock ngay
```

---

### **Rule 7: THAY ĐỔI PLAN → THÔNG BÁO**
```
[TIME] AGENT → ALL
[CHANGE] Task X - Plan Change

📋 Original: <original plan>
🔄 New: <new plan>
❓ Lý do: <why change>
⏱️ Impact: <timeline impact>

@agentFE: Vui lòng approve
```

**Ví dụ:**
```
[2026-05-02 09:30] BE1 → ALL
[CHANGE] Task 3 - Detection API Approach

📋 Original: Implement real-time detection với queue
🔄 New: Use mock detection với 2s delay
❓ Lý do: PCXR model chưa sẵn sàng, queue phức tạp
⏱️ Impact: Giảm 1 giờ (từ 2h → 1h)

@agentFE: Vui lòng approve approach mới
```

---

## 🎯 COORDINATOR (agentFE - Kiro) RESPONSIBILITIES

### **Tôi (Kiro) sẽ:**

**1. ĐỌC CHAT LIÊN TỤC**
- Check chat2.md mỗi 15-30 phút
- Đọc tất cả updates từ agents
- Identify blockers và issues

**2. HỖ TRỢ KHI CẦN**
- Trả lời questions trong < 15 phút
- Unblock blockers trong < 30 phút
- Provide guidance và decisions

**3. ĐIỀU PHỐI TEAM**
- Reassign tasks nếu cần
- Adjust priorities
- Resolve conflicts

**4. TRACK PROGRESS**
- Monitor timeline
- Update sprint status
- Report to User

---

## 📊 COMMUNICATION MATRIX

| Situation | Action | Format | Response Time |
|-----------|--------|--------|---------------|
| Bắt đầu task | Ghi [START] | Rule 1 | - |
| Gặp lỗi | Ghi [ERROR] + tag @agentFE | Rule 2 | < 15 min |
| Cần info | Ghi [QUESTION] + tag @agentFE | Rule 3 | < 15 min |
| Hoàn thành | Ghi [DONE] | Rule 4 | - |
| Progress | Ghi [UPDATE] mỗi 30 phút | Rule 5 | - |
| Bị block | Ghi [BLOCKER] + tag @agentFE | Rule 6 | < 30 min |
| Đổi plan | Ghi [CHANGE] + tag @agentFE | Rule 7 | < 15 min |

---

## ✅ BENEFITS

### **Khi tuân thủ protocol này:**
1. ✅ **Transparency:** Mọi người biết ai đang làm gì
2. ✅ **Fast unblock:** Blockers được giải quyết nhanh
3. ✅ **No duplication:** Không ai làm trùng việc
4. ✅ **Better coordination:** Kiro điều phối hiệu quả
5. ✅ **Clear timeline:** Biết rõ progress và ETA
6. ✅ **Easy debugging:** Có log đầy đủ khi có vấn đề
7. ✅ **Team morale:** Mọi người thấy progress rõ ràng

---

## ❌ CONSEQUENCES

### **Khi KHÔNG tuân thủ:**
1. ❌ **Silent failures:** Lỗi không ai biết
2. ❌ **Wasted time:** Blockers kéo dài
3. ❌ **Confusion:** Không biết ai làm gì
4. ❌ **Missed deadlines:** Timeline không track được
5. ❌ **Poor coordination:** Kiro không thể hỗ trợ
6. ❌ **Duplicate work:** Nhiều người làm cùng việc
7. ❌ **Frustration:** Team không sync

---

## 📝 EXAMPLES - GOOD vs BAD

### **❌ BAD - KHÔNG TUÂN THỦ:**
```
[Silent for 2 hours]
[No updates]
[Suddenly] "Tôi bị lỗi rồi, không biết làm sao"
[No context, no error message, no files]
```

**Result:** Kiro không thể hỗ trợ, waste 2 giờ

---

### **✅ GOOD - TUÂN THỦ:**
```
[08:20] BE1 → ALL
[START] Task 3.5 - Integration Testing

[08:25] BE1 → ALL
[ERROR] Migration failed - relation exists
@agentFE: Need help

[08:27] agentFE → BE1
[RESPONSE] Try: DROP TABLE episodes CASCADE;

[08:30] BE1 → ALL
[UPDATE] Migration fixed, server starting

[08:35] BE1 → ALL
[DONE] Task 3.5 complete, server ready
@FE: Bắt đầu Task 4
```

**Result:** Problem solved trong 15 phút, team sync

---

## 🚀 STARTING NOW

**Từ bây giờ (08:15), TẤT CẢ AGENTS phải:**

1. ✅ Ghi [START] khi bắt đầu task
2. ✅ Ghi [UPDATE] mỗi 30 phút
3. ✅ Ghi [ERROR] ngay khi gặp lỗi
4. ✅ Ghi [QUESTION] khi cần info
5. ✅ Ghi [BLOCKER] khi bị block
6. ✅ Ghi [DONE] khi hoàn thành
7. ✅ Tag @agentFE khi cần hỗ trợ

**Kiro (agentFE) sẽ:**
- ✅ Đọc chat mỗi 15-30 phút
- ✅ Respond trong < 15 phút
- ✅ Unblock trong < 30 phút

---

## 📍 CHAT LOCATION

**Primary:** `/mnt/e/project/webrag/note/agent_chat/chat2.md`  
**Backup:** `/mnt/e/project/webrag/note/agent_chat/chat3.md` (khi chat2 đầy)

---

**Status:** 🔴 MANDATORY - Áp dụng ngay  
**Effective:** 02/05/2026 08:15  
**Review:** End of day

---

**BẮT ĐẦU NGAY! 🚀**
