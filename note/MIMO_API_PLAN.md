---
noteId: "mimo-api-plan-20260502"
tags: ["mimo", "api", "llm", "infrastructure", "planning"]
created: 2026-05-02T09:00:00Z
priority: HIGH
---

# 🤖 KẾ HOẠCH TRIỂN KHAI MIMO API & MỞ RỘNG TEAM

**Ngày:** 02/05/2026  
**Người lập:** Kiro (agentFE - Coordinator)  
**Status:** Draft - Chờ duyệt

---

## 📊 MIMO API - THÔNG TIN

### **Plan Details:**
- **Credits:** 700,000,000 (700M)
- **Base URL (OpenAI compatible):** `https://token-plan-sgp.xiaomimimo.com/v1`
- **Base URL (Anthropic compatible):** `https://token-plan-sgp.xiaomimimo.com/anthropic`
- **Off-peak hours:** 16:00-24:00 UTC (23:00-07:00 VN) → 0.8x credits

### **Available Models:**
| Model | Type | Use Case |
|-------|------|----------|
| MiMo-V2.5-Pro | LLM | Primary generation |
| MiMo-V2.5 | LLM | Fallback/secondary |
| MiMo-V2-Pro | LLM | Complex reasoning |
| MiMo-V2-Omni | Multimodal | Image + Text analysis |
| MiMo-V2.5-TTS | Text-to-Speech | Voice output |
| MiMo-V2.5-TTS-VoiceClone | Voice Cloning | Custom voice |
| MiMo-V2.5-TTS-VoiceDesign | Voice Design | Voice generation |

---

## 🎯 SỬ DỤNG MIMO TRONG HỆ THỐNG

### **Current Architecture:**
```
User → Frontend → Backend API → Ollama (A100) → Response
```

### **New Architecture (with MiMo):**
```
User → Frontend → Backend API → [Ollama (A100) OR MiMo API] → Response
                                    │
                                    └── Racing strategy:
                                        - Call both parallel
                                        - First response wins
                                        - Store both for comparison
```

### **Use Cases:**

**1. Primary LLM (MiMo-V2.5-Pro):**
- Generate answers cho RAG queries
- Explain detection results
- Draft reports

**2. Fallback LLM (Ollama qwen2.5:7b):**
- Khi MiMo down hoặc timeout
- Local processing (privacy)
- Cost optimization

**3. Multimodal (MiMo-V2-Omni):**
- Image analysis (X-rays)
- Replace/augment PCXR model
- Visual detection

**4. TTS (MiMo-V2.5-TTS):**
- Voice output cho reports
- Accessibility features
- Training voice clone

---

## 💰 CREDIT USAGE ESTIMATE

### **Off-peak hours: 23:00-07:00 VN (0.8x credits)**
- Best time for batch processing
- RAG ingestion
- Model training

### **Estimated Usage:**
| Operation | Model | Credits/query | Daily queries | Monthly |
|-----------|-------|---------------|---------------|---------|
| RAG Query | V2.5-Pro | ~500 | 100 | 15M |
| Explain | V2.5-Pro | ~800 | 50 | 12M |
| Draft Report | V2.5-Pro | ~1,200 | 20 | 7.2M |
| Image Analysis | V2-Omni | ~2,000 | 30 | 18M |
| TTS | V2.5-TTS | ~300 | 10 | 0.9M |
| **Total** | | | | **~53M/month** |

### **700M credits = ~13 tháng usage**
→ Rất dồi dào cho MVP và testing

---

## 🏗️ IMPLEMENTATION PLAN

### **PHASE 1: Basic Integration (1-2 giờ)**

**Files cần tạo/sửa:**

1. **`apps/api/src/lib/mimo/client.ts`** (NEW)
```typescript
// MiMo API client with OpenAI compatible interface
export class MimoClient {
  private baseUrl: string;
  private apiKey: string;
  
  constructor() {
    this.baseUrl = process.env.MIMO_BASE_URL!;
    this.apiKey = process.env.MIMO_API_KEY!;
  }
  
  async chat(model: string, messages: any[], options?: any) {
    // OpenAI compatible API call
  }
  
  async analyzeImage(imageBuffer: Buffer) {
    // MiMo-V2-Omni for image analysis
  }
  
  async textToSpeech(text: string, voice?: string) {
    // MiMo-V2.5-TTS
  }
}
```

2. **`apps/api/.env`** (UPDATE)
```env
# MiMo API
MIMO_API_KEY=tp-sfnksz************************************nkteoz
MIMO_BASE_URL=https://token-plan-sgp.xiaomimimo.com/v1
MIMO_MODEL_PRIMARY=MiMo-V2.5-Pro
MIMO_MODEL_FALLBACK=MiMo-V2.5
MIMO_MODEL_OMNI=MiMo-V2-Omni
MIMO_MODEL_TTS=MiMo-V2.5-TTS
```

3. **`apps/api/src/lib/llm/racing.ts`** (NEW)
```typescript
// Multi-LLM racing strategy
export class LLMRacer {
  async race(query: string, context: string) {
    // Call both Ollama and MiMo parallel
    // First response wins
    // Store both for comparison
  }
}
```

**Success criteria:**
- ✅ MiMo API call thành công
- ✅ Racing strategy hoạt động
- ✅ Fallback logic đúng

---

### **PHASE 2: Advanced Features (1-2 ngày)**

1. **TTS Integration:**
   - Voice output cho reports
   - Accessibility

2. **Image Analysis:**
   - Replace/augment PCXR model
   - Visual detection với MiMo-V2-Omni

3. **Batch Processing:**
   - Off-peak hours scheduling
   - Credit optimization

4. **Monitoring:**
   - Credit usage tracking
   - Performance metrics
   - Cost optimization

---

### **PHASE 3: Production (1 ngày)**

1. **Rate Limiting:**
   - Prevent overuse
   - Queue management

2. **Caching:**
   - Cache common queries
   - Reduce API calls

3. **Error Handling:**
   - Retry logic
   - Fallback chains
   - Alert system

4. **Documentation:**
   - API docs
   - Usage guide
   - Cost tracking

---

## 👥 TEAM STRUCTURE HIỆN TẠI

### **Current Team (3 members):**
| Agent | Role | Skills | Workload |
|-------|------|--------|----------|
| **Kiro (agentFE)** | Coordinator | Architecture, Planning | 100% (monitoring) |
| **FE (agentUI)** | Frontend | Next.js, React, TS | 80% (waiting for tasks) |
| **BE1 (agentBE)** | Backend Core | Express, Supabase, TS | 60% (some tasks left) |
| **BE2 (AI/ML)** | AI/ML | Ollama, RAG, Python | 70% (RAG done, PCXR pending) |

### **Gaps Identified:**
1. ❌ **No DevOps/Infrastructure specialist**
   - A100 server management
   - Cloudflare tunnel
   - Deployment pipeline
   - Monitoring

2. ❌ **No QA/Testing**
   - Manual testing
   - E2E tests
   - Performance testing
   - Security testing

3. ❌ **No Data Engineer**
   - Data pipeline
   - Embedding optimization
   - Database performance
   - Data quality

4. ❌ **No Security Specialist**
   - Penetration testing
   - Security audit
   - Compliance (HIPAA/GDPR)
   - Data encryption

---

## 🎯 RECOMMENDED NEW ROLES

### **Option A: Add 1 DevOps Engineer (RECOMMENDED)**

**Vai trò:**
- A100 server management
- CI/CD pipeline
- Monitoring & alerting
- Infrastructure as code
- Deployment automation
- Performance optimization

**Tasks:**
1. Setup automated deployment
2. Monitor A100 GPU usage
3. Setup logging & alerting
4. Optimize infrastructure costs
5. Security hardening

**Priority:** 🔴 HIGH

**Why needed:**
- A100 management phức tạp
- Cloudflare tunnel cần monitoring
- Deployment pipeline chưa có
- Infrastructure cost optimization quan trọng
- Team đang thiếu người lo infra

---

### **Option B: Add 1 QA/Testing Engineer**

**Vai trò:**
- Manual & automated testing
- E2E tests
- Performance testing
- Bug tracking
- Quality assurance

**Tasks:**
1. Write E2E tests
2. Performance benchmark
3. Security testing
4. User acceptance testing
5. Bug reporting

**Priority:** 🟡 MEDIUM

**Why needed:**
- Không có testing hiện tại
- Integration testing thủ công
- Performance chưa benchmark
- Security chưa audit

---

### **Option C: Add 1 Data Engineer (Optional)**

**Vai trò:**
- Data pipeline optimization
- Embedding quality improvement
- Database performance
- Data quality monitoring

**Tasks:**
1. Optimize RAG pipeline
2. Improve embedding quality
3. Database indexing
4. Data validation

**Priority:** 🟢 LOW

**Why needed:**
- Tokenizer bug chưa fix
- Embedding quality cần improvement
- Database performance chưa tối ưu

---

## 📊 FINAL RECOMMENDATION

### **Thêm 2 roles:**

**1. DevOps Engineer (BE3) - URGENT**
- Setup CI/CD
- Monitor A100 + Cloudflare
- Automated deployment
- Infrastructure optimization
- Security hardening

**2. QA/Testing Engineer (BE4) - MEDIUM**
- E2E tests
- Performance testing
- Security audit
- Bug tracking
- Quality assurance

### **Why 2 roles:**
- Team hiện tại 4 người, nhưng thiếu infra + testing
- DevOps sẽ lo A100 + deployment → giải phóng BE1, BE2
- QA sẽ đảm bảo chất lượng → giảm bugs production
- Total team: 6 people ( Coordinator + FE + BE1 + BE2 + DevOps + QA)

---

## 🎯 TEAM STRUCTURE MỚI (6 members)

```
                    Kiro (agentFE)
                    Coordinator
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   FE (agentUI)    BE1 (agentBE)    BE2 (AI/ML)
   Frontend        Backend Core     AI/ML RAG
        │                │                │
        └────────────────┼────────────────┘
                         │
              ┌──────────┼──────────┐
              │                     │
        BE3 (DevOps)          BE4 (QA/Testing)
        Infrastructure         Quality Assurance
```

### **Responsibilities:**
| Agent | Focus | Tasks |
|-------|-------|-------|
| Kiro | Coordination | Planning, Review, Unblock |
| FE | Frontend | UI, Animations, Integration |
| BE1 | Backend | APIs, Database, Auth |
| BE2 | AI/ML | RAG, PCXR, MiMo Integration |
| BE3 | DevOps | A100, CI/CD, Monitoring, Security |
| BE4 | QA | Testing, Benchmark, Bug tracking |

---

## 📋 MIMO IMPLEMENTATION TIMELINE

### **Day 1 (08:04 - 10:04):**
- BE2: Create MimoClient
- BE2: Integrate với Knowledge Agent
- BE2: Test racing strategy
- BE2: Setup environment variables

### **Day 1 (10:04 - 12:04):**
- BE2: Add fallback logic
- BE2: Test image analysis (V2-Omni)
- BE2: Setup TTS integration
- BE2: Document usage

### **Day 2:**
- BE2: Batch processing optimization
- BE2: Off-peak scheduling
- BE2: Credit monitoring
- BE2: Performance benchmark

**Total:** 1.5 ngày

---

## ✅ NEXT ACTIONS

### **For User:**
1. ✅ Approve MiMo integration plan
2. ✅ Decide: Add DevOps? Add QA? Both?
3. ✅ Provide A100 credentials cho DevOps
4. ✅ Confirm budget cho additional roles

### **For BE2:**
1. ⏳ Start MiMo integration (Phase 1)
2. ⏳ Create MimoClient
3. ⏳ Test racing strategy

### **For BE1:**
1. ⏳ Continue Detection API
2. ⏳ Prepare for MiMo backend integration

### **For FE:**
1. ⏳ Fix lazy load performance
2. ⏳ Add loading indicators
3. ⏳ Optimize bundle size

---

**Status:** 📋 Plan Ready - Waiting for User Approval  
**Priority:** 🔴 HIGH - Cần quyết định team structure  
**Estimated:** MiMo integration 1.5 ngày + DevOps setup 2 ngày
