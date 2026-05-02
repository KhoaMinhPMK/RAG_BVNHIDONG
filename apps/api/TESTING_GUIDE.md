---
noteId: "6223a840454511f1b3ce19fa7351e6bb"
tags: []

---

# Backend Testing Guide

## Bước 1: Start Server

Mở terminal mới và chạy:

```bash
cd E:\project\webrag\apps\api
yarn dev
```

Hoặc dùng batch file:
```bash
E:\project\webrag\apps\api\start.bat
```

## Bước 2: Kiểm tra Server Đang Chạy

Mở browser hoặc dùng curl:

**Health Check:**
```
http://localhost:3001/health
```

Kết quả mong đợi:
```json
{
  "status": "ok",
  "timestamp": "2026-05-01T...",
  "uptime": 123.45,
  "environment": "development",
  "services": {
    "supabase": "connected",
    "ollama": "connected"
  }
}
```

**API Root:**
```
http://localhost:3001/api
```

Kết quả mong đợi:
```json
{
  "message": "WebRAG API Server",
  "version": "0.1.0",
  "endpoints": {
    "health": "GET /health",
    "query": "POST /api/query",
    "explain": "POST /api/explain",
    "draft": "POST /api/draft"
  }
}
```

## Bước 3: Test Authentication (Cần Supabase User)

### 3.1. Tạo Test User trong Supabase

Vào Supabase Dashboard → SQL Editor, chạy:

```sql
-- Tạo test user (nếu chưa có)
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'test@example.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
);

-- Tạo profile cho user
INSERT INTO public.profiles (
  user_id,
  email,
  full_name,
  role,
  department
) VALUES (
  (SELECT id FROM auth.users WHERE email = 'test@example.com'),
  'test@example.com',
  'Test Clinician',
  'clinician',
  'Pediatrics'
);
```

### 3.2. Login để lấy JWT Token

**Option A: Dùng Frontend (nếu UI đang chạy)**
- Vào http://localhost:3002/login
- Login với test@example.com / password123
- Mở DevTools → Application → Local Storage → xem Supabase session

**Option B: Dùng curl**
```bash
curl -X POST https://mibtdruhmmcatccdzjjk.supabase.co/auth/v1/token?grant_type=password \
  -H "apikey: YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

Lưu lại `access_token` từ response.

### 3.3. Test API với JWT Token

**Test Query Endpoint:**
```bash
curl -X POST http://localhost:3001/api/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Triệu chứng viêm phổi ở trẻ em là gì?"
  }'
```

**Kết quả mong đợi:**
```json
{
  "success": true,
  "answer": "...",
  "citations": [...],
  "model_version": "qwen2.5:7b",
  "timestamp": "...",
  "status": "success"
}
```

**Test Unauthorized (không có token):**
```bash
curl -X POST http://localhost:3001/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test"
  }'
```

**Kết quả mong đợi:**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

## Bước 4: Kiểm tra Logs

Server sẽ in logs ra console:

```
2026-05-01 10:05:00 [info]: 🚀 API Server running on http://localhost:3001
2026-05-01 10:05:00 [info]: 📝 Environment: development
2026-05-01 10:05:00 [info]: 🔗 CORS origin: http://localhost:3002
2026-05-01 10:05:00 [info]: Testing connections...
2026-05-01 10:05:01 [info]: ✅ All services connected successfully
```

## Bước 5: Kiểm tra Database

Vào Supabase Dashboard → Table Editor:

**Kiểm tra audit_logs:**
```sql
SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10;
```

Mỗi API call sẽ tạo 1 audit log entry.

**Kiểm tra query_sessions:**
```sql
SELECT * FROM query_sessions ORDER BY created_at DESC LIMIT 10;
```

Mỗi query sẽ tạo 1 session record.

## Troubleshooting

### Server không start
- Kiểm tra port 3001 có bị chiếm không: `netstat -ano | findstr :3001`
- Kiểm tra .env file có đúng không
- Kiểm tra yarn dependencies: `yarn install`

### Supabase connection failed
- Kiểm tra SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY trong .env
- Test connection: `curl https://mibtdruhmmcatccdzjjk.supabase.co/rest/v1/`

### Ollama connection failed
- Kiểm tra Ollama đang chạy: `curl http://localhost:11434/api/tags`
- Kiểm tra model đã pull: `ollama list`
- Pull model nếu chưa có: `ollama pull qwen2.5:7b`

### JWT validation failed
- Kiểm tra token chưa expired
- Kiểm tra SUPABASE_URL đúng với project
- Kiểm tra user tồn tại trong auth.users và profiles

## Kết quả Mong Đợi

Nếu mọi thứ hoạt động:
- ✅ Server start thành công
- ✅ Health check trả về "ok"
- ✅ Supabase connected
- ✅ Ollama connected
- ✅ JWT authentication hoạt động
- ✅ Query endpoint trả về answer + citations
- ✅ Audit logs được ghi vào database
- ✅ Guardrails chặn diagnosis/prescription keywords

## Next Steps

Sau khi verify backend hoạt động:
1. Test với UI (frontend integration)
2. Test các edge cases (invalid input, timeout, etc.)
3. Load testing (concurrent requests)
4. Implement Multi-LLM Racing (sau khi có approval)
