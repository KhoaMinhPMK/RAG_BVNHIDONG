---
noteId: "backend-integration-gaps-20260501"
tags: ["backend", "integration", "todo"]
created: 2026-05-01T15:12:00Z
---

# Backend Integration Gaps Analysis

**Mục đích:** Phân tích các tính năng UI đã có nhưng chưa được backend hỗ trợ, đề xuất phương án triển khai.

**Người tạo:** agentUI  
**Người nhận:** agentFE (điều phối) → agentBE (triển khai)

---

## 📊 Tổng Quan

### ✅ Đã Hoàn Thành (Backend + Frontend)
1. **Authentication System**
   - ✅ Supabase Auth integration
   - ✅ JWT validation middleware
   - ✅ RBAC middleware với 4 roles
   - ✅ Login/Logout flow
   - ✅ Protected routes
   - ✅ User profiles table

2. **API Routes (Core)**
   - ✅ `/api/query` - Knowledge Agent (RAG retrieval)
   - ✅ `/api/explain` - Explainer Agent (detection explanation)
   - ✅ `/api/draft` - Reporter Agent (draft report generation)
   - ✅ All routes có `authenticateJWT` + RBAC

3. **Middleware Stack**
   - ✅ Auth middleware (JWT validation)
   - ✅ RBAC middleware (permission checking)
   - ✅ Guardrails middleware (safety checks)
   - ✅ Audit middleware (logging)

---

## ❌ Chưa Hoàn Thành (UI có, Backend chưa)

### 1. **Worklist Page** (`/`)
**UI Status:** ✅ Hoàn chỉnh (mock data)  
**Backend Status:** ❌ Chưa có API

**Hiện tại:**
- Mock data: 5 episodes với status khác nhau
- Polling simulation (30s countdown)
- Status: `pending_detection`, `pending_explain`, `pending_draft`, `pending_approval`, `completed`

**Cần Backend:**
```typescript
// GET /api/episodes
// Query params: ?status=pending_explain&limit=50&offset=0
Response: {
  episodes: Episode[],
  total: number,
  hasMore: boolean
}

interface Episode {
  id: string;              // EP-2024-XXX
  patient_ref: string;     // BN-2024-XXX
  age: string;
  gender: string;
  date: string;
  findings: string[];
  status: CaseStatus;
  updated_at: string;
  created_by: string;      // user_id
}
```

**Phương án triển khai:**
- **Option A (Recommended):** Tạo `/api/episodes` route mới
  - GET `/api/episodes` - List episodes với pagination
  - GET `/api/episodes/:id` - Get single episode
  - POST `/api/episodes` - Create new episode
  - PATCH `/api/episodes/:id` - Update episode status
  - Permissions: `episodes:read`, `episodes:create`, `episodes:update`

- **Option B:** Extend existing routes
  - Thêm episode management vào `/api/query` route
  - Ít clean hơn, không khuyến khích

**Database:**
- Table `episodes` đã có trong schema.sql (line 80-95)
- Cần seed data hoặc migration để tạo test episodes

---

### 2. **Upload Page** (`/cases/new`)
**UI Status:** ✅ Hoàn chỉnh (mock upload)  
**Backend Status:** ❌ Chưa có API

**Hiện tại:**
- Drag & drop file upload (PNG/JPEG/DICOM)
- Patient info form (11 fields)
- File validation (max 10MB)
- Mock submit → redirect to case detail

**Cần Backend:**
```typescript
// POST /api/episodes/upload
// Content-Type: multipart/form-data
Request: {
  files: File[],           // X-ray images
  patient_info: {
    age: string,
    gender: string,
    pid: string,
    date: string,
    ward: string,
    symptoms: string,
    days: string,
    spo2: string,
    temp: string,
    crp: string,
    wbc: string
  }
}

Response: {
  episode_id: string,
  status: 'pending_detection',
  upload_urls: string[]    // Presigned URLs for file upload
}
```

**Phương án triển khai:**
- **Option A (Recommended):** Supabase Storage + Queue
  1. POST `/api/episodes/upload` → Create episode record
  2. Generate presigned URLs for Supabase Storage
  3. Frontend uploads files to presigned URLs
  4. Backend triggers PCXR detection job (queue)
  5. Webhook updates episode status when done

- **Option B:** Direct upload to backend
  1. POST `/api/episodes/upload` với multipart/form-data
  2. Backend saves files to local storage
  3. Trigger PCXR detection synchronously
  4. Return episode_id when done
  - ❌ Không scale, blocking request

**Database:**
- Table `episodes` - store patient info
- Table `images` (NEW) - store image metadata
  ```sql
  CREATE TABLE images (
    image_id UUID PRIMARY KEY,
    episode_id UUID REFERENCES episodes(episode_id),
    storage_path TEXT,
    file_name TEXT,
    file_size INTEGER,
    mime_type TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

**Storage:**
- Supabase Storage bucket: `xray-images`
- Path structure: `{episode_id}/{image_id}.{ext}`

---

### 3. **Case Detail Page** (`/cases/[id]`)
**UI Status:** ✅ Hoàn chỉnh (mock data + PCXR samples)  
**Backend Status:** ⚠️ Một phần (có API agents, chưa có episode API)

**Hiện tại:**
- 3-step flow: Detection → Explain → Draft
- PCXR detection results (10 samples hardcoded)
- Explainer Agent UI (streaming simulation)
- Draft Report UI (field editing)
- Fullscreen viewer với zoom/pan

**Cần Backend:**

#### 3.1. Episode Detail API
```typescript
// GET /api/episodes/:id
Response: {
  episode: Episode,
  images: Image[],
  detection_results: DetectionResult | null,
  explanation: Explanation | null,
  draft_report: DraftReport | null
}
```

#### 3.2. Detection Trigger API
```typescript
// POST /api/episodes/:id/detect
// Trigger PCXR detection for uploaded images
Response: {
  job_id: string,
  status: 'queued' | 'processing' | 'completed' | 'failed'
}

// GET /api/episodes/:id/detect/status
// Poll detection status
Response: {
  status: 'processing' | 'completed',
  progress: number,        // 0-100
  results: DetectionResult | null
}
```

#### 3.3. Explain Trigger API
```typescript
// POST /api/episodes/:id/explain
// Already exists as /api/explain
// Just need to wire it up with episode_id
```

#### 3.4. Draft Trigger API
```typescript
// POST /api/episodes/:id/draft
// Already exists as /api/draft
// Just need to wire it up with episode_id
```

**Phương án triển khai:**
- **Option A (Recommended):** RESTful episode routes
  - GET `/api/episodes/:id` - Get full episode data
  - POST `/api/episodes/:id/detect` - Trigger detection
  - GET `/api/episodes/:id/detect/status` - Poll status
  - POST `/api/episodes/:id/explain` - Trigger explain (wrapper for `/api/explain`)
  - POST `/api/episodes/:id/draft` - Trigger draft (wrapper for `/api/draft`)

- **Option B:** Keep existing routes, add episode context
  - Frontend calls `/api/explain` with `episode_id`
  - Backend fetches episode data internally
  - Less RESTful, but simpler

**PCXR Integration:**
- ❌ PCXR model chưa được integrate
- Hiện tại: Frontend dùng 10 hardcoded samples
- Cần: agentML integrate PCXR model → API endpoint

---

### 4. **Knowledge Base Page** (`/knowledge`)
**UI Status:** ✅ UI hoàn chỉnh (mock data)  
**Backend Status:** ❌ Chưa có API

**Hiện tại:**
- Document list (4 mock documents)
- Search bar (disabled)
- Filter (disabled)
- Upload button (disabled)
- Stats: Total docs, chunks, sources, queue

**Cần Backend:**
```typescript
// GET /api/knowledge/documents
Response: {
  documents: Document[],
  stats: {
    total_documents: number,
    total_chunks: number,
    sources: string[],
    queue_size: number
  }
}

interface Document {
  document_id: string,
  title: string,
  source: string,
  type: 'Guideline' | 'Protocol' | 'SOP',
  chunks: number,
  status: 'active' | 'pending' | 'error',
  updated_at: string
}

// POST /api/knowledge/upload
// Upload new document (PDF/DOCX)
Request: multipart/form-data {
  file: File,
  metadata: {
    title: string,
    source: string,
    type: string
  }
}

Response: {
  document_id: string,
  status: 'pending',
  job_id: string
}

// GET /api/knowledge/search?q=pneumonia&limit=10
Response: {
  results: SearchResult[],
  total: number
}
```

**Phương án triển khai:**
- **Option A (Recommended):** Document Sourcing Agent
  1. POST `/api/knowledge/upload` → Save to Supabase Storage
  2. Trigger chunking + embedding job (queue)
  3. Store chunks in `document_chunks` table
  4. Generate embeddings with Ollama (nomic-embed)
  5. Store in pgvector
  6. Update document status to 'active'

- **Option B:** Manual upload + processing
  1. Admin uploads PDF manually
  2. Backend processes synchronously
  3. No queue, blocking request
  - ❌ Không scale

**Database:**
- Tables đã có trong schema.sql:
  - `documents` (line 11-25)
  - `document_chunks` (line 34-44)
  - `document_versions` (line 49-59)

**Embedding:**
- ❌ Embedding model chưa được setup
- Cần: Ollama nomic-embed model
- Cần: Chunking strategy (512 tokens overlap 50)

---

### 5. **Admin Page** (`/admin`)
**UI Status:** ✅ UI hoàn chỉnh (mock data)  
**Backend Status:** ❌ Chưa có API

**Hiện tại:**
- RBAC overview (4 roles, permissions)
- User list (3 mock users)
- Audit log (4 mock entries)
- System config display

**Cần Backend:**
```typescript
// GET /api/admin/users
Response: {
  users: User[],
  total: number
}

interface User {
  user_id: string,
  email: string,
  full_name: string,
  role: Role,
  status: 'active' | 'inactive',
  last_seen: string,
  created_at: string
}

// GET /api/admin/audit-logs?limit=50&offset=0
Response: {
  logs: AuditLog[],
  total: number
}

interface AuditLog {
  log_id: string,
  timestamp: string,
  user_id: string,
  user_name: string,
  action: string,
  detail: string,
  status: 'ok' | 'error',
  ip_address: string,
  user_agent: string
}

// GET /api/admin/stats
Response: {
  total_users: number,
  total_episodes: number,
  total_documents: number,
  total_queries: number,
  system_health: 'healthy' | 'degraded' | 'down'
}
```

**Phương án triển khai:**
- **Option A (Recommended):** Admin routes
  - GET `/api/admin/users` - List users (admin only)
  - GET `/api/admin/audit-logs` - List audit logs (admin only)
  - GET `/api/admin/stats` - System stats (admin only)
  - POST `/api/admin/users/:id/role` - Update user role (admin only)
  - Permissions: `admin:*`

- **Option B:** Extend existing routes
  - GET `/api/profiles` - List all profiles (admin only)
  - Less semantic, không khuyến khích

**Database:**
- Table `profiles` - already has users
- Table `audit_logs` (NEW) - store audit events
  ```sql
  CREATE TABLE audit_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES profiles(user_id),
    action TEXT NOT NULL,
    detail TEXT,
    status TEXT,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB
  );
  ```

**Audit Logging:**
- ✅ Audit middleware đã có (apps/api/src/middleware/audit.ts)
- ❌ Chưa write vào database, chỉ log ra console
- Cần: Update audit middleware để write vào `audit_logs` table

---

## 🎯 Ưu Tiên Triển Khai

### Phase 1: Core Episode Management (Sprint 2)
**Priority: HIGH**

1. **Episodes API** (3-5 days)
   - GET `/api/episodes` - List episodes
   - GET `/api/episodes/:id` - Get episode detail
   - POST `/api/episodes/upload` - Upload new case
   - PATCH `/api/episodes/:id` - Update status
   - Database: Seed test episodes

2. **PCXR Detection Integration** (5-7 days)
   - POST `/api/episodes/:id/detect` - Trigger detection
   - GET `/api/episodes/:id/detect/status` - Poll status
   - Queue system (BullMQ hoặc Supabase Edge Functions)
   - agentML: Integrate PCXR model

3. **Image Storage** (2-3 days)
   - Supabase Storage setup
   - Presigned URL generation
   - Image metadata table

**Outcome:** Worklist + Upload + Case Detail hoạt động end-to-end

---

### Phase 2: Knowledge Base (Sprint 3)
**Priority: MEDIUM**

1. **Document Management API** (3-4 days)
   - GET `/api/knowledge/documents` - List documents
   - POST `/api/knowledge/upload` - Upload document
   - GET `/api/knowledge/search` - Search documents

2. **Document Processing Pipeline** (5-7 days)
   - PDF parsing (pdf-parse hoặc LangChain)
   - Chunking strategy (512 tokens, 50 overlap)
   - Embedding generation (Ollama nomic-embed)
   - pgvector storage

3. **RAG Enhancement** (2-3 days)
   - Update Knowledge Agent để dùng real embeddings
   - Semantic search với pgvector
   - Citation tracking

**Outcome:** Knowledge Base hoạt động, RAG dùng real documents

---

### Phase 3: Admin & Monitoring (Sprint 4)
**Priority: LOW**

1. **Admin API** (2-3 days)
   - GET `/api/admin/users` - User management
   - GET `/api/admin/audit-logs` - Audit logs
   - GET `/api/admin/stats` - System stats

2. **Audit Logging** (1-2 days)
   - Update audit middleware để write vào database
   - Audit log retention policy (30 days)

3. **Monitoring Dashboard** (2-3 days)
   - System health checks
   - Performance metrics
   - Error tracking

**Outcome:** Admin có thể quản lý users, xem audit logs, monitor system

---

## 📋 Database Migrations Cần Thiết

### Migration 1: Images Table
```sql
CREATE TABLE images (
  image_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES episodes(episode_id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_images_episode ON images(episode_id);
```

### Migration 2: Audit Logs Table
```sql
CREATE TABLE audit_logs (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES profiles(user_id),
  action TEXT NOT NULL,
  detail TEXT,
  status TEXT CHECK (status IN ('ok', 'error')),
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
```

### Migration 3: Fix Profiles Table
```sql
-- Current schema uses `user_id` as primary key
-- But auth-context.tsx was using `id` (now fixed to `user_id`)
-- Verify column name matches:
ALTER TABLE profiles RENAME COLUMN id TO user_id;  -- If needed
```

---

## 🔧 Technical Decisions Needed

### 1. Queue System
**Question:** Dùng queue nào cho async jobs (PCXR detection, document processing)?

**Options:**
- **A. BullMQ** (Redis-based)
  - ✅ Mature, feature-rich
  - ✅ Job retry, priority, scheduling
  - ❌ Cần Redis instance
  
- **B. Supabase Edge Functions**
  - ✅ Serverless, no infrastructure
  - ✅ Integrated với Supabase
  - ❌ Cold start latency
  
- **C. Simple polling** (no queue)
  - ✅ Simplest
  - ❌ Không scale, blocking

**Recommendation:** BullMQ (Option A) cho production, polling (Option C) cho MVP

---

### 2. File Storage
**Question:** Store images ở đâu?

**Options:**
- **A. Supabase Storage**
  - ✅ Integrated, presigned URLs
  - ✅ CDN, access control
  - ✅ Recommended
  
- **B. Local filesystem**
  - ✅ Simple
  - ❌ Không scale, no CDN
  
- **C. S3/CloudFlare R2**
  - ✅ Scalable, cheap
  - ❌ Extra service

**Recommendation:** Supabase Storage (Option A)

---

### 3. Embedding Model
**Question:** Dùng model nào cho embeddings?

**Options:**
- **A. Ollama nomic-embed**
  - ✅ Local, free
  - ✅ Good quality
  - ❌ Cần GPU
  
- **B. OpenAI text-embedding-3-small**
  - ✅ Best quality
  - ❌ Cost $$$
  
- **C. Sentence Transformers (local)**
  - ✅ Free, decent quality
  - ❌ Slower than Ollama

**Recommendation:** Ollama nomic-embed (Option A) cho MVP

---

## 📊 Effort Estimation

| Feature | Backend Effort | Frontend Effort | Total |
|---------|---------------|-----------------|-------|
| Episodes API | 3-5 days | 1 day (integration) | 4-6 days |
| PCXR Detection | 5-7 days | 2 days (polling UI) | 7-9 days |
| Image Upload | 2-3 days | 1 day (presigned URLs) | 3-4 days |
| Knowledge Base | 8-10 days | 1 day (integration) | 9-11 days |
| Admin API | 2-3 days | 0.5 day (integration) | 2.5-3.5 days |
| Audit Logging | 1-2 days | 0 days | 1-2 days |
| **TOTAL** | **21-30 days** | **5.5 days** | **26.5-35.5 days** |

**Note:** Estimates assume 1 backend developer working full-time.

---

## 🚀 Next Steps

### For agentFE (Điều phối):
1. Review document này
2. Prioritize features với user/stakeholder
3. Chọn technical decisions (queue, storage, embedding)
4. Assign tasks cho agentBE
5. Update sprint planning

### For agentBE:
1. Đọc document này
2. Clarify technical decisions với agentFE
3. Bắt đầu Phase 1: Episodes API
4. Setup database migrations
5. Integrate PCXR model (coordinate với agentML)

### For agentUI:
1. Đợi agentBE hoàn thành APIs
2. Replace mock data với real API calls
3. Handle loading states, errors
4. Test end-to-end flows

---

## 📝 Notes

- Document này được tạo tự động bởi agentUI sau khi phân tích toàn bộ codebase
- Tất cả estimates là ballpark, có thể thay đổi
- Priority có thể adjust dựa trên business needs
- Technical decisions cần confirm với team trước khi implement

---

**END OF DOCUMENT**
