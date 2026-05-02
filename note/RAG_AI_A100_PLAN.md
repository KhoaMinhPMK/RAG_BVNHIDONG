---
noteId: "rag-ai-a100-plan-20260502"
tags: ["rag", "ai", "a100", "ml", "planning"]
created: 2026-05-02T06:43:00Z
priority: HIGH
assignee: BE2 (AI/ML Engineer)
---

# 🤖 KẾ HOẠCH RAG & AI TRÊN A100

**Ngày tạo:** 02/05/2026 06:43  
**Người tạo:** Kiro (agentFE - Coordinator)  
**Assignee:** BE2 (AI/ML Engineer)  
**Scope:** Tất cả components liên quan đến AI/ML

---

## 🎯 TỔNG QUAN

### **Mục tiêu:**
Xây dựng và quản lý toàn bộ AI/ML infrastructure trên A100 server, bao gồm:
1. RAG Pipeline (Retrieval Augmented Generation)
2. PCXR Model (Pneumonia Detection)
3. LLM Integration (Ollama)
4. Embedding Generation
5. Vector Search Optimization

### **Tại sao cần BE2 (AI/ML Engineer)?**
- BE1 focus vào backend core (APIs, database, auth)
- AI/ML cần expertise riêng (model training, optimization, deployment)
- A100 server cần quản lý chuyên biệt
- RAG pipeline phức tạp, cần fine-tuning

---

## 📊 HIỆN TRẠNG

### ✅ **Đã có (Code complete):**
1. RAG Ingestion Pipeline (10 files)
   - PDF Parser
   - Chunker (semantic splitting)
   - Embedding Client (Ollama)
   - Batch Processor
   - CLI Tool

2. AI Agents (3 agents)
   - Knowledge Agent (RAG)
   - Explainer Agent
   - Reporter Agent

3. Database Schema
   - documents table
   - document_chunks table (pgvector)
   - Vector search function (SQL)

### ⏳ **Chưa test:**
- RAG Ingestion (chờ A100 access)
- Vector search performance
- Embedding quality

### ❌ **Chưa có:**
- PCXR Model (đang train)
- Model serving infrastructure
- RAG quality monitoring
- Model versioning
- A/B testing framework

---

## 🏗️ KIẾN TRÚC AI/ML

```
┌─────────────────────────────────────────────────────────────┐
│                    A100 SERVER                               │
│  GPU: NVIDIA A100 (40GB/80GB)                               │
└─────────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Ollama     │  │ PCXR Model   │  │  Training    │
│              │  │              │  │  Pipeline    │
│ - qwen2.5:7b │  │ - Detection  │  │              │
│ - nomic-     │  │ - Bounding   │  │ - Data prep  │
│   embed-text │  │   boxes      │  │ - Training   │
│              │  │ - Confidence │  │ - Validation │
└──────────────┘  └──────────────┘  └──────────────┘
        │                  │                  │
        │                  │                  │
        ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend API (Express.js)                        │
│  - RAG endpoints                                            │
│  - PCXR inference endpoints                                 │
│  - Model management endpoints                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 👤 VAI TRÒ BE2 (AI/ML ENGINEER)

### **Responsibilities:**

**1. A100 Server Management**
- Setup và maintain Ollama
- Deploy models
- Monitor GPU usage
- Optimize inference performance

**2. RAG Pipeline**
- Test và optimize ingestion
- Fine-tune chunking strategy
- Improve embedding quality
- Monitor retrieval accuracy

**3. PCXR Model**
- Complete training
- Deploy model
- Create inference API
- Integrate với backend

**4. Model Operations (MLOps)**
- Model versioning
- A/B testing
- Performance monitoring
- Quality metrics

**5. AI Infrastructure**
- Model serving (FastAPI/TorchServe)
- Batch inference
- Caching strategies
- Load balancing

---

## 📋 TASK BREAKDOWN

### **PHASE 1: RAG SETUP & TESTING (2-3 ngày)**

#### **Task 1.1: A100 Environment Setup (0.5 ngày)**
**Priority:** 🔴 URGENT  
**Effort:** 4 giờ

**Cần làm:**
```bash
# 1. SSH vào A100
ssh user@a100-server

# 2. Verify Ollama
ollama --version
ollama list

# 3. Pull models
ollama pull qwen2.5:7b
ollama pull nomic-embed-text

# 4. Verify models
ollama list | grep qwen2.5
ollama list | grep nomic-embed-text

# 5. Test inference
ollama run qwen2.5:7b "Hello"
curl http://localhost:11434/api/embeddings \
  -d '{"model": "nomic-embed-text", "prompt": "test"}'

# 6. Setup Cloudflare Tunnel (nếu chưa có)
cloudflared tunnel --url http://localhost:11434
```

**Success criteria:**
- ✅ SSH access hoạt động
- ✅ Ollama running
- ✅ 2 models pulled
- ✅ Inference test pass
- ✅ Tunnel accessible từ backend

---

#### **Task 1.2: RAG Ingestion Testing (1 ngày)**
**Priority:** 🔴 HIGH  
**Effort:** 1 day

**Cần làm:**

**Step 1: Run SQL Migration**
```sql
-- File: apps/api/supabase-migrations/create-vector-search-function.sql
-- Run trong Supabase SQL Editor
```

**Step 2: Test Ingestion**
```bash
cd /mnt/e/project/webrag/apps/api

# Test với 1 PDF nhỏ trước
npx tsx src/scripts/ingest-documents.ts \
  /path/to/test.pdf

# Verify trong database
# Check documents table
# Check document_chunks table (có embeddings)
```

**Step 3: Test Vector Search**
```bash
# Call API endpoint
curl -X POST http://localhost:3005/api/query \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Triệu chứng viêm phổi ở trẻ em?",
    "episodeId": "test-001"
  }'

# Verify response có citations từ ingested docs
```

**Step 4: Ingest Full Knowledge Base**
```bash
# Ingest 2 PDFs chính
npx tsx src/scripts/ingest-documents.ts \
  /path/to/PERCH_guideline.pdf

npx tsx src/scripts/ingest-documents.ts \
  /path/to/VinDr_dataset.pdf
```

**Success criteria:**
- ✅ Ingestion hoàn thành không lỗi
- ✅ Database có ~70 chunks với embeddings
- ✅ Vector search trả về relevant results
- ✅ Citations chính xác
- ✅ Latency < 3s

**Files cần check:**
- `apps/api/src/scripts/ingest-documents.ts`
- `apps/api/src/lib/ingestion/service.ts`
- `apps/api/src/lib/embedding/client.ts`
- `apps/api/src/agents/knowledge.ts`

---

#### **Task 1.3: RAG Quality Evaluation (0.5 ngày)**
**Priority:** 🟡 MEDIUM  
**Effort:** 4 giờ

**Cần làm:**

**1. Create Test Queries**
```typescript
// apps/api/src/scripts/test-rag-quality.ts
const testQueries = [
  "Triệu chứng viêm phổi ở trẻ em?",
  "Cách chẩn đoán viêm phổi?",
  "Điều trị viêm phổi như thế nào?",
  "Kháng sinh nào dùng cho viêm phổi?",
  "Biến chứng của viêm phổi?",
];

for (const query of testQueries) {
  const result = await knowledgeAgent.query(query);
  console.log(`Query: ${query}`);
  console.log(`Answer: ${result.answer}`);
  console.log(`Citations: ${result.citations.length}`);
  console.log(`Relevance: ${evaluateRelevance(result)}`);
}
```

**2. Metrics to Track**
- Retrieval accuracy (top-k precision)
- Citation relevance
- Response latency
- Embedding quality (cosine similarity distribution)

**3. Create Quality Report**
```markdown
# RAG Quality Report

## Test Results
- Total queries: 10
- Avg latency: 2.3s
- Citation accuracy: 85%
- Retrieval precision@5: 0.78

## Issues Found
- Query X: No relevant chunks found
- Query Y: Wrong citation

## Recommendations
- Adjust chunk size to 400 tokens
- Lower similarity threshold to 0.65
- Add more documents
```

**Success criteria:**
- ✅ 10 test queries evaluated
- ✅ Quality metrics documented
- ✅ Issues identified
- ✅ Recommendations provided

---

### **PHASE 2: PCXR MODEL DEPLOYMENT (5-7 ngày)**

#### **Task 2.1: Complete PCXR Training (3-4 ngày)**
**Priority:** 🔴 HIGH  
**Effort:** 3-4 days

**Cần làm:**

**1. Training Pipeline**
```python
# Location: /path/to/pcxr-training/
# Framework: PyTorch + Lightning

# Training script
python train.py \
  --data_dir /data/vindr-pcxr \
  --model resnet50 \
  --epochs 50 \
  --batch_size 32 \
  --lr 1e-4 \
  --gpu 0

# Monitor training
tensorboard --logdir logs/
```

**2. Model Validation**
```python
# Validation metrics
- mAP (mean Average Precision)
- Precision/Recall per class
- Confusion matrix
- ROC curves

# Target metrics:
- mAP > 0.75
- Precision > 0.80
- Recall > 0.75
```

**3. Model Export**
```python
# Export to ONNX for production
python export_onnx.py \
  --checkpoint best_model.ckpt \
  --output pcxr_model.onnx

# Verify ONNX model
python test_onnx.py --model pcxr_model.onnx
```

**Success criteria:**
- ✅ Training converged (loss plateau)
- ✅ Validation metrics meet targets
- ✅ Model exported to ONNX
- ✅ Inference test pass

---

#### **Task 2.2: Model Serving Setup (1 ngày)**
**Priority:** 🔴 HIGH  
**Effort:** 1 day

**Cần làm:**

**1. Create FastAPI Service**
```python
# apps/pcxr-service/main.py
from fastapi import FastAPI, File, UploadFile
import onnxruntime as ort
import numpy as np
from PIL import Image

app = FastAPI()

# Load model
session = ort.InferenceSession("pcxr_model.onnx")

@app.post("/detect")
async def detect_pneumonia(file: UploadFile):
    # Preprocess image
    image = Image.open(file.file)
    input_tensor = preprocess(image)
    
    # Run inference
    outputs = session.run(None, {"input": input_tensor})
    
    # Post-process
    detections = postprocess(outputs)
    
    return {
        "findings": detections,
        "model_version": "v1.0",
        "processing_time_ms": 150
    }

@app.get("/health")
async def health():
    return {"status": "ok"}
```

**2. Deploy Service**
```bash
# On A100 server
cd apps/pcxr-service
pip install -r requirements.txt

# Run service
uvicorn main:app --host 0.0.0.0 --port 8000

# Test
curl -X POST http://localhost:8000/detect \
  -F "file=@test_xray.png"
```

**3. Setup Cloudflare Tunnel**
```bash
cloudflared tunnel --url http://localhost:8000
# Get public URL: https://xxx.trycloudflare.com
```

**Success criteria:**
- ✅ FastAPI service running
- ✅ Inference < 500ms per image
- ✅ Accessible via tunnel
- ✅ Health check pass

---

#### **Task 2.3: Backend Integration (1 ngày)**
**Priority:** 🔴 HIGH  
**Effort:** 1 day

**Cần làm:**

**1. Create PCXR Client**
```typescript
// apps/api/src/lib/pcxr/client.ts
export class PCXRClient {
  private baseUrl: string;
  
  constructor() {
    this.baseUrl = process.env.PCXR_SERVICE_URL!;
  }
  
  async detect(imageBuffer: Buffer): Promise<Detection> {
    const formData = new FormData();
    formData.append('file', imageBuffer, 'xray.png');
    
    const response = await fetch(`${this.baseUrl}/detect`, {
      method: 'POST',
      body: formData,
    });
    
    return await response.json();
  }
}
```

**2. Update Upload API**
```typescript
// apps/api/src/routes/upload.ts
router.post('/episodes/:id/detect', async (req, res) => {
  const { id } = req.params;
  
  // Get image from Supabase Storage
  const imageBuffer = await getImage(id);
  
  // Run PCXR detection
  const pcxrClient = new PCXRClient();
  const detection = await pcxrClient.detect(imageBuffer);
  
  // Save detection results
  await saveDetection(id, detection);
  
  res.json({ success: true, detection });
});
```

**3. Replace Mock Detection**
```typescript
// Remove: apps/web/src/lib/pcxr/mock-detection.ts
// Use: Real PCXR API
```

**Success criteria:**
- ✅ PCXR client hoạt động
- ✅ Upload API integrated
- ✅ Detection results saved to DB
- ✅ Frontend hiển thị real detections

---

### **PHASE 3: AI INFRASTRUCTURE (3-4 ngày)**

#### **Task 3.1: Model Versioning (1 ngày)**
**Priority:** 🟡 MEDIUM  
**Effort:** 1 day

**Cần làm:**

**1. Model Registry**
```python
# apps/model-registry/
# Store model metadata

models = {
  "pcxr": {
    "v1.0": {
      "path": "/models/pcxr_v1.0.onnx",
      "metrics": {"mAP": 0.78, "precision": 0.82},
      "created_at": "2026-05-05",
      "status": "production"
    },
    "v1.1": {
      "path": "/models/pcxr_v1.1.onnx",
      "metrics": {"mAP": 0.81, "precision": 0.85},
      "created_at": "2026-05-10",
      "status": "staging"
    }
  }
}
```

**2. Version Management API**
```typescript
// apps/api/src/routes/models.ts
router.get('/models/:name/versions', async (req, res) => {
  const versions = await getModelVersions(req.params.name);
  res.json(versions);
});

router.post('/models/:name/deploy/:version', async (req, res) => {
  await deployModel(req.params.name, req.params.version);
  res.json({ success: true });
});
```

**Success criteria:**
- ✅ Model registry setup
- ✅ Version management API
- ✅ Easy rollback capability

---

#### **Task 3.2: Performance Monitoring (1 ngày)**
**Priority:** 🟡 MEDIUM  
**Effort:** 1 day

**Cần làm:**

**1. Metrics Collection**
```typescript
// apps/api/src/lib/monitoring/metrics.ts
export class AIMetrics {
  async logInference(modelName: string, latency: number, result: any) {
    await supabase.from('ai_metrics').insert({
      model_name: modelName,
      latency_ms: latency,
      timestamp: new Date(),
      result_summary: result,
    });
  }
  
  async getMetrics(modelName: string, timeRange: string) {
    // Aggregate metrics
    return {
      avg_latency: 250,
      p95_latency: 450,
      p99_latency: 800,
      total_requests: 1000,
      error_rate: 0.02,
    };
  }
}
```

**2. Dashboard**
```typescript
// apps/api/src/routes/monitoring.ts
router.get('/monitoring/ai-metrics', async (req, res) => {
  const metrics = await aiMetrics.getMetrics('pcxr', '24h');
  res.json(metrics);
});
```

**Success criteria:**
- ✅ Metrics logged for all AI calls
- ✅ Dashboard API ready
- ✅ Alerts for slow inference

---

#### **Task 3.3: A/B Testing Framework (1 ngày)**
**Priority:** 🟢 LOW  
**Effort:** 1 day

**Cần làm:**

**1. Experiment Framework**
```typescript
// apps/api/src/lib/experiments/ab-test.ts
export class ABTest {
  async assignVariant(userId: string, experimentName: string) {
    // Hash-based assignment
    const hash = hashUserId(userId);
    const variant = hash % 2 === 0 ? 'A' : 'B';
    
    await logAssignment(userId, experimentName, variant);
    return variant;
  }
  
  async getModelForVariant(variant: string) {
    return variant === 'A' ? 'pcxr_v1.0' : 'pcxr_v1.1';
  }
}
```

**2. Integration**
```typescript
// In detection endpoint
const variant = await abTest.assignVariant(userId, 'pcxr_model_test');
const modelVersion = await abTest.getModelForVariant(variant);
const detection = await pcxrClient.detect(image, modelVersion);
```

**Success criteria:**
- ✅ A/B test framework ready
- ✅ Easy to run experiments
- ✅ Metrics tracked per variant

---

## 📊 TIMELINE TỔNG THỂ

```
Week 1 (Day 1-5):
├─ Day 1: A100 Setup + RAG Testing Start
├─ Day 2: RAG Testing Complete + Quality Eval
├─ Day 3: PCXR Training Start
├─ Day 4: PCXR Training Continue
└─ Day 5: PCXR Training Complete

Week 2 (Day 6-10):
├─ Day 6: Model Serving Setup
├─ Day 7: Backend Integration
├─ Day 8: Model Versioning
├─ Day 9: Performance Monitoring
└─ Day 10: A/B Testing + Buffer

Total: 10 days (2 weeks)
```

---

## 🎯 SUCCESS CRITERIA

### **RAG Pipeline:**
- ✅ Ingestion hoạt động (2 PDFs ingested)
- ✅ Vector search < 500ms
- ✅ Citation accuracy > 80%
- ✅ Query latency < 3s

### **PCXR Model:**
- ✅ Training complete (mAP > 0.75)
- ✅ Model deployed on A100
- ✅ Inference < 500ms
- ✅ Integrated với backend

### **Infrastructure:**
- ✅ Model versioning ready
- ✅ Performance monitoring active
- ✅ A/B testing framework ready

---

## 📋 DELIVERABLES

### **Code:**
1. RAG quality evaluation script
2. PCXR FastAPI service
3. PCXR client library
4. Model registry
5. Monitoring dashboard API
6. A/B testing framework

### **Documentation:**
1. A100 setup guide
2. RAG quality report
3. PCXR model card
4. API documentation
5. Deployment guide

### **Models:**
1. PCXR model (ONNX)
2. Model metadata
3. Performance benchmarks

---

## 🚨 RISKS & MITIGATION

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| A100 access delayed | HIGH | MEDIUM | Use local GPU for testing |
| PCXR training fails | HIGH | LOW | Use pre-trained weights |
| Model too slow | MEDIUM | MEDIUM | Optimize with TensorRT |
| RAG quality low | MEDIUM | MEDIUM | Fine-tune chunking |
| Ollama unstable | MEDIUM | LOW | Add retry logic |

---

## 📞 COORDINATION

### **With BE1:**
- BE1 provides API endpoints structure
- BE2 implements AI logic
- BE1 handles database, BE2 handles models

### **With FE:**
- FE provides UI requirements
- BE2 provides detection format
- Coordinate on loading states

### **With User:**
- Provide A100 access
- Review model quality
- Approve deployment

---

## 🔗 REFERENCES

**Documents:**
- `RAG_INGESTION_IMPLEMENTATION_PLAN.md`
- `BACKEND_INTEGRATION_GAPS.md`
- `apps/api/README.md`

**Code:**
- `apps/api/src/lib/ingestion/`
- `apps/api/src/lib/embedding/`
- `apps/api/src/agents/knowledge.ts`

**External:**
- Ollama docs: https://ollama.ai/docs
- ONNX Runtime: https://onnxruntime.ai
- FastAPI: https://fastapi.tiangolo.com

---

**Status:** 📋 Plan Ready - Waiting for BE2 Assignment  
**Priority:** 🔴 HIGH  
**Estimated:** 10 days (2 weeks)  
**Next:** Assign BE2 role và bắt đầu Phase 1
