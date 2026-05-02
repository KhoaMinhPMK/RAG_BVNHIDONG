---
noteId: "107a5840453611f1b3ce19fa7351e6bb"
tags: []

---

# WebRAG API Server

Backend API cho hệ thống RAG Y tế Nhi khoa - Hỗ trợ chẩn đoán viêm phổi.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env and fill in your credentials

# Run development server
npm run dev

# Server will start at http://localhost:3001
```

## 📋 Environment Variables

```env
# Server
PORT=3001
NODE_ENV=development

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b

# CORS
CORS_ORIGIN=http://localhost:3000

# Logging
LOG_LEVEL=info
```

## 🔌 API Endpoints

### Health Check
```
GET /health
Response: { status: "ok", services: { supabase: "connected", ollama: "connected" } }
```

### Authentication
**All API endpoints require authentication via Bearer token.**

```
Authorization: Bearer <supabase_access_token>
```

Lấy token từ frontend:
```javascript
const { data: { session } } = await supabase.auth.getSession()
const token = session?.access_token
```

### Knowledge Query (S02)
```
POST /api/query
Headers: {
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
}
Body: {
  query: string,
  episode_id?: string
}
```

### Explainer Agent (S03)
```
POST /api/explain
Headers: {
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
}
Body: {
  episode_id: string,
  detection: DetectionPayload,
  clinical_data?: any
}
```

### Reporter Agent (S05)
```
POST /api/draft
Headers: {
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
}
Body: {
  episode_id: string,
  template_id: string,
  detection: DetectionPayload,
  clinical_data?: any
}
```

## 🛡️ Security Features

### Guardrails
- ✅ No-diagnosis: LLM không được tự sinh chẩn đoán mới
- ✅ No-prescription: Không kê đơn/y lệnh
- ✅ Citation-required: Mọi answer phải có citations
- ✅ PII sanitization: Auto-redact phone, email, ID numbers

### RBAC (Role-Based Access Control)
- **clinician**: query, explain, draft:create, draft:edit, draft:approve
- **radiologist**: query, explain, draft:create, draft:edit, draft:approve
- **researcher**: query, explain, draft:create, compare:models, audit:view
- **admin**: All permissions + knowledge:manage + template:manage

### Audit Logging
- 100% traceability cho mọi action
- Auto-log: query, explain, draft:create, draft:edit, draft:approve
- Stored in `audit_logs` table với timestamp, user_id, action, details

## 🏗️ Architecture

```
src/
├── agents/          # 3 AI agents
│   ├── knowledge.ts # RAG retrieval (< 3s)
│   ├── explainer.ts # Detection → Explanation (< 5s)
│   └── reporter.ts  # Template → Draft (< 8s)
├── lib/
│   ├── supabase/    # Database client + schema
│   └── ollama/      # LLM client với retry logic
├── middleware/
│   ├── rbac.ts      # Permission matrix
│   ├── guardrails.ts # Safety checks
│   └── audit.ts     # Auto-logging
├── routes/          # Express routes
├── types/           # TypeScript types (API contract)
└── utils/           # Logger, helpers
```

## 📊 Database Schema

12 tables trong Supabase:
- `documents` - Knowledge base
- `document_chunks` - Vector embeddings
- `document_versions` - Version history
- `profiles` - Users + RBAC
- `episodes` - Patient context
- `report_templates` - Form templates
- `draft_reports` - Draft reports
- `query_sessions` - RAG history
- `feedback_logs` - User feedback
- `audit_logs` - Audit trail
- `document_sourcing_queue` - Async agent queue
- `document_candidates` - Pending approval

## 🧪 Testing

```bash
# Type check
npm run typecheck

# Build
npm run build

# Production
npm start
```

## 📝 Notes

- Ollama model: qwen2.5:7b (4.68 GB, ~45-54 tokens/s)
- Latency targets: Query < 3s, Explain < 5s, Draft < 8s
- All responses follow `ApiResponse<T>` format
- Error codes: INSUFFICIENT_EVIDENCE, OUT_OF_SCOPE, POLICY_BLOCKED, UNAUTHORIZED, INVALID_INPUT, NOT_FOUND, INTERNAL_ERROR

## 🔗 Integration với Frontend

Frontend (Next.js) gọi API với:
```typescript
const response = await fetch('http://localhost:3001/api/query', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-user-role': 'clinician',
  },
  body: JSON.stringify({ query: '...', role: 'clinician' }),
});

const data = await response.json();
if (data.success) {
  // Use data.answer, data.citations
} else {
  // Handle data.error
}
```
