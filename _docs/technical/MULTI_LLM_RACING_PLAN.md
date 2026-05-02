---
noteId: "520862d0454411f1b3ce19fa7351e6bb"
tags: []

---

# Multi-LLM Racing Strategy — Kế hoạch Tích hợp

**Ngày tạo:** 2026-05-01  
**Tác giả:** agentBE  
**Trạng thái:** Draft — Chờ phản hồi từ agentFE/agentUI

---

## 📋 Tóm tắt Yêu cầu

User muốn bổ sung phương thức kết nối LLM mới:

### API Provider Mới: MiMo (xiaomimomo.com)
- **Base URL (OpenAI-compatible):** `https://token-plan-sgp.xiaomimomo.com/v1`
- **Base URL (Anthropic-compatible):** `https://token-plan-sgp.xiaomimomo.com/anthropic`
- **API Key:** `tp-sfnksz************************************nkteoz` (user sẽ tự cấu hình vào .env)
- **Models:** MiMo-V2.5-Pro, MiMo-V2.5, MiMo-V2-Pro, MiMo-V2-Omni, etc.
- **Credits:** 700M credits
- **Off-peak discount:** 0.8x (16:00–24:00 UTC)

### Chiến lược "LLM Racing"
> **"Model nào trả lời trước thì hiển thị trước, model còn lại lưu lại để user xem sau nếu muốn"**

**Flow:**
1. User gửi query → Backend gọi **song song** nhiều LLM providers (Ollama + MiMo + ...)
2. Model nào trả lời **trước** → trả về frontend ngay lập tức
3. Model còn lại tiếp tục chạy → lưu kết quả vào database
4. User có thể xem "alternative answers" từ các model khác

---

## 🎯 Mục tiêu Thiết kế

### 1. **Latency Optimization**
- Giảm thời gian chờ đợi cho user (hiển thị kết quả nhanh nhất)
- Tận dụng nhiều LLM providers để tăng reliability

### 2. **Cost Optimization**
- Sử dụng off-peak hours của MiMo (0.8x credits)
- Fallback khi Ollama local bị quá tải

### 3. **Quality Comparison**
- User có thể so sánh câu trả lời từ nhiều models
- Hữu ích cho medical domain (cần second opinion)

---

## 🏗️ Kiến trúc Đề xuất

### Option A: Race-to-First (Recommended)
```
User Query
    ↓
Backend API
    ├─→ Ollama (qwen2.5:7b) ──┐
    ├─→ MiMo (MiMo-V2.5-Pro) ─┤
    └─→ MiMo (MiMo-V2-Pro) ───┤
                               ↓
                        Promise.race()
                               ↓
                    First response → User
                               ↓
                    Other responses → Database
```

**Pros:**
- Fastest response time
- Simple implementation
- User gets answer immediately

**Cons:**
- Tốn credits cho tất cả models (even if not used)
- Cần cancel mechanism cho slow models

### Option B: Sequential Fallback
```
User Query
    ↓
Try Ollama (local, free)
    ├─→ Success → Return
    └─→ Timeout/Error
            ↓
        Try MiMo-V2.5-Pro
            ├─→ Success → Return
            └─→ Error
                    ↓
                Try MiMo-V2-Pro
```

**Pros:**
- Cost-effective (only pay if local fails)
- Predictable behavior

**Cons:**
- Slower (sequential, not parallel)
- Không tận dụng được "racing" advantage

### Option C: Hybrid (Smart Racing)
```
User Query
    ↓
Primary: Ollama (local)
    ├─→ If response < 2s → Return immediately
    └─→ If slow (>2s) → Trigger MiMo race
                            ↓
                    Return fastest result
                            ↓
                    Save all results to DB
```

**Pros:**
- Best of both worlds
- Cost-effective (prefer local)
- Fast fallback if local is slow

**Cons:**
- More complex logic
- Need timeout tuning

---

## 🔧 Implementation Plan

### Phase 1: Multi-Provider Infrastructure

#### 1.1. Create LLM Provider Abstraction
**File:** `apps/api/src/lib/llm/base-provider.ts`

```typescript
interface LLMProvider {
  name: string;
  generate(prompt: string, options?: GenerateOptions): Promise<LLMResponse>;
  testConnection(): Promise<boolean>;
}

interface LLMResponse {
  provider: string;
  model: string;
  content: string;
  latency: number;
  timestamp: string;
  metadata?: Record<string, any>;
}
```

#### 1.2. Implement MiMo Provider
**File:** `apps/api/src/lib/llm/mimo-provider.ts`

```typescript
class MiMoProvider implements LLMProvider {
  private baseUrl: string;
  private apiKey: string;
  
  constructor(config: { baseUrl: string; apiKey: string }) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
  }
  
  async generate(prompt: string, options?: GenerateOptions): Promise<LLMResponse> {
    // Call MiMo API (OpenAI-compatible)
    // Handle streaming if needed
    // Return structured response
  }
}
```

#### 1.3. Refactor Ollama Provider
**File:** `apps/api/src/lib/llm/ollama-provider.ts`

Refactor existing `OllamaClient` to implement `LLMProvider` interface.

#### 1.4. Create LLM Manager (Racing Logic)
**File:** `apps/api/src/lib/llm/llm-manager.ts`

```typescript
class LLMManager {
  private providers: LLMProvider[];
  
  async raceGenerate(prompt: string, options?: RaceOptions): Promise<{
    primary: LLMResponse;
    alternatives: LLMResponse[];
  }> {
    // Promise.race() logic
    // Save all responses to database
    // Return fastest + others
  }
  
  async sequentialGenerate(prompt: string, fallbackOrder: string[]): Promise<LLMResponse> {
    // Try providers in order
    // Return first success
  }
}
```

### Phase 2: Database Schema for Alternative Responses

#### 2.1. New Table: `llm_responses`
**File:** `apps/api/src/lib/supabase/schema.sql`

```sql
CREATE TABLE llm_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_session_id UUID REFERENCES query_sessions(id),
  provider TEXT NOT NULL,  -- 'ollama', 'mimo', etc.
  model TEXT NOT NULL,      -- 'qwen2.5:7b', 'MiMo-V2.5-Pro', etc.
  content TEXT NOT NULL,
  latency_ms INTEGER,
  is_primary BOOLEAN DEFAULT false,  -- true if this was returned to user first
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_llm_responses_session ON llm_responses(query_session_id);
CREATE INDEX idx_llm_responses_primary ON llm_responses(is_primary);
```

### Phase 3: Update Agents to Use LLM Manager

#### 3.1. Update Knowledge Agent
**File:** `apps/api/src/agents/knowledge.ts`

```typescript
class KnowledgeAgent {
  private llmManager: LLMManager;
  
  async query(query: string, episodeId?: string) {
    // ... existing RAG logic ...
    
    // Replace ollamaClient.generate() with:
    const { primary, alternatives } = await this.llmManager.raceGenerate(prompt, {
      providers: ['ollama', 'mimo-v2.5-pro'],
      timeout: 5000,
    });
    
    // Save alternatives to database
    await this.saveAlternativeResponses(sessionId, alternatives);
    
    // Return primary response
    return primary;
  }
}
```

#### 3.2. Update Explainer Agent
Similar changes to `apps/api/src/agents/explainer.ts`

#### 3.3. Update Reporter Agent
Similar changes to `apps/api/src/agents/reporter.ts`

### Phase 4: API Endpoints for Alternative Responses

#### 4.1. New Endpoint: Get Alternative Responses
**File:** `apps/api/src/routes/alternatives.ts`

```typescript
// GET /api/query/:sessionId/alternatives
router.get('/query/:sessionId/alternatives', 
  authenticateJWT,
  requirePermission('query:knowledge'),
  async (req, res) => {
    const { sessionId } = req.params;
    
    // Fetch all non-primary responses for this session
    const alternatives = await getAlternativeResponses(sessionId);
    
    res.json({
      success: true,
      alternatives: alternatives.map(alt => ({
        provider: alt.provider,
        model: alt.model,
        content: alt.content,
        latency: alt.latency_ms,
        timestamp: alt.created_at,
      })),
    });
  }
);
```

### Phase 5: Frontend Integration (Coordination with agentUI)

#### 5.1. Update API Client
**File:** `apps/web/src/lib/api/client.ts`

```typescript
export async function getAlternativeResponses(sessionId: string) {
  return apiCall<{
    alternatives: Array<{
      provider: string;
      model: string;
      content: string;
      latency: number;
      timestamp: string;
    }>;
  }>(`/api/query/${sessionId}/alternatives`, {
    method: 'GET',
  });
}
```

#### 5.2. UI Component: Alternative Answers Viewer
**Needs agentUI to implement:**
- Tabs or accordion to show alternative responses
- Model comparison view
- Latency indicators
- "Mark as preferred" functionality

---

## ❓ Câu hỏi Cần Làm rõ

### 1. **Racing Strategy**
**Q:** Nên dùng Option A (Race-to-First), B (Sequential), hay C (Hybrid)?

**Recommendation:** Option C (Hybrid) vì:
- Ưu tiên Ollama local (free, fast)
- Fallback to MiMo nếu Ollama chậm
- Tiết kiệm credits nhưng vẫn đảm bảo latency

**Cần xác nhận:**
- User có đồng ý với hybrid approach không?
- Timeout threshold bao nhiêu để trigger MiMo? (đề xuất: 2-3s)

### 2. **Cost Management**
**Q:** Có nên implement credit tracking và budget limits không?

**Concerns:**
- MiMo có 700M credits nhưng không unlimited
- Nếu racing tất cả queries → burn credits nhanh
- Cần mechanism để track usage?

**Đề xuất:**
- Thêm table `llm_usage_logs` để track credits
- Environment variable `MAX_DAILY_CREDITS`
- Alert khi gần hết credits

### 3. **Model Selection**
**Q:** Dùng model nào của MiMo cho từng agent?

**Available models:**
- MiMo-V2.5-Pro (most capable?)
- MiMo-V2.5 (standard)
- MiMo-V2-Pro (older generation)
- MiMo-V2-Omni (multimodal?)

**Recommendation:**
- Knowledge Agent: MiMo-V2.5-Pro (cần accuracy cao)
- Explainer Agent: MiMo-V2.5-Pro (medical explanation)
- Reporter Agent: MiMo-V2.5 (structured output, ít phức tạp hơn)

**Cần xác nhận:**
- Model nào phù hợp nhất cho medical domain?
- Có cần test performance trước không?

### 4. **Streaming Support**
**Q:** MiMo có support streaming responses không?

**Impact:**
- Nếu có streaming → user thấy response nhanh hơn (token-by-token)
- Nếu không → phải đợi full response

**Cần research:**
- MiMo API có endpoint `/v1/chat/completions` với `stream: true` không?
- Nếu có → cần update frontend để handle SSE

### 5. **Error Handling**
**Q:** Khi tất cả providers fail thì làm gì?

**Scenarios:**
- Ollama down + MiMo API error
- MiMo rate limit exceeded
- Network timeout

**Đề xuất:**
- Return graceful error message
- Log to audit trail
- Suggest user retry later

### 6. **Alternative Response Storage**
**Q:** Lưu tất cả alternative responses hay chỉ lưu top N?

**Trade-offs:**
- Lưu tất cả: database lớn, nhưng có full history
- Lưu top 2-3: tiết kiệm storage, đủ cho comparison

**Recommendation:** Lưu tất cả (medical domain cần traceability)

### 7. **User Preference**
**Q:** Có cho phép user chọn preferred provider không?

**Use case:**
- User thích MiMo hơn Ollama (hoặc ngược lại)
- User muốn force dùng local model (privacy)

**Đề xuất:**
- Thêm user setting: `preferred_llm_provider`
- Nếu set → skip racing, dùng provider đó trực tiếp

### 8. **Off-Peak Optimization**
**Q:** Có nên tự động schedule queries vào off-peak hours không?

**MiMo off-peak:** 16:00–24:00 UTC (0.8x credits)

**Scenarios:**
- Non-urgent queries → queue và chạy lúc off-peak
- Urgent queries → chạy ngay

**Cần xác nhận:**
- Medical queries có thể delay được không? (có lẽ không)
- Nếu không → skip optimization này

### 9. **Anthropic-Compatible Endpoint**
**Q:** MiMo có 2 endpoints (OpenAI + Anthropic). Dùng cái nào?

**Options:**
- OpenAI-compatible: `/v1` (standard, dễ integrate)
- Anthropic-compatible: `/anthropic` (có lợi gì?)

**Recommendation:** Dùng OpenAI-compatible vì:
- Standard format
- Nhiều libraries support
- Dễ swap providers

**Cần xác nhận:** Có lý do gì phải dùng Anthropic endpoint không?

### 10. **Testing Strategy**
**Q:** Test như thế nào trước khi deploy?

**Cần test:**
- MiMo API connection
- Racing logic (mock slow responses)
- Error handling (mock API failures)
- Cost tracking accuracy

**Đề xuất:**
- Create `test-mimo.ts` script
- Mock racing scenarios
- Load test với concurrent requests

---

## 📊 Impact Analysis

### Backend Changes
- **New files:** 5-7 files (providers, manager, routes)
- **Modified files:** 3 agents, 1 route file
- **Database:** 1 new table, 2-3 indexes
- **Estimated LOC:** ~800-1000 lines

### Frontend Changes (cần agentUI)
- **New components:** AlternativeAnswersViewer
- **Modified components:** Query result display
- **API client:** 1 new function
- **Estimated LOC:** ~200-300 lines

### Configuration
- **New env vars:**
  - `MIMO_API_KEY`
  - `MIMO_BASE_URL`
  - `MIMO_DEFAULT_MODEL`
  - `LLM_RACING_ENABLED` (feature flag)
  - `LLM_RACING_TIMEOUT` (ms)

### Testing Effort
- **Unit tests:** Provider classes, racing logic
- **Integration tests:** End-to-end query flow
- **Manual testing:** Compare response quality
- **Estimated time:** 2-3 hours

---

## 🚀 Rollout Plan

### Phase 1: Infrastructure (Day 1)
1. Create provider abstraction
2. Implement MiMo provider
3. Create LLM manager with racing logic
4. Add database table

### Phase 2: Agent Integration (Day 1-2)
1. Update Knowledge Agent
2. Update Explainer Agent
3. Update Reporter Agent
4. Add alternative responses endpoint

### Phase 3: Frontend Integration (Day 2)
1. Update API client (agentBE)
2. Create UI components (agentUI)
3. Add model comparison view (agentUI)

### Phase 4: Testing & Tuning (Day 2-3)
1. Test MiMo connection
2. Test racing logic
3. Tune timeout thresholds
4. Load testing

### Phase 5: Documentation (Day 3)
1. Update API documentation
2. Add configuration guide
3. Create troubleshooting guide

---

## 🎯 Success Metrics

### Performance
- [ ] Average query latency < 3s (with racing)
- [ ] 95th percentile latency < 5s
- [ ] Racing overhead < 200ms

### Reliability
- [ ] Fallback success rate > 95%
- [ ] Zero queries fail due to single provider outage

### Cost
- [ ] Average cost per query < X credits (TBD)
- [ ] Off-peak usage > 50% (if applicable)

### User Experience
- [ ] Users can view alternative responses
- [ ] Clear indication of which model was used
- [ ] Latency displayed for each response

---

## 📝 Next Steps

### Immediate Actions (agentBE)
1. ✅ Tạo file kế hoạch này
2. ⏳ Gửi message vào agent chat để agentFE/agentUI review
3. ⏳ Chờ feedback về:
   - Racing strategy (A/B/C?)
   - Model selection
   - UI requirements

### Waiting For
- **agentFE:** Review architecture, clarify questions
- **agentUI:** Confirm UI requirements for alternative responses
- **User:** Confirm approach và provide MiMo API key

### After Approval
- Start implementation Phase 1
- Coordinate with agentUI for frontend changes
- Test with real MiMo API

---

## 📚 References

- MiMo API Documentation: (cần link)
- OpenAI API Compatibility: https://platform.openai.com/docs/api-reference
- Current Ollama Implementation: `apps/api/src/lib/ollama/client.ts`
- Current Agent Implementation: `apps/api/src/agents/`

---

**Status:** 📋 Draft — Awaiting Review  
**Next Reviewer:** agentFE (architecture) → agentUI (UI requirements) → User (final approval)
