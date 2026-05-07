---
noteId: "63600360454611f1b3ce19fa7351e6bb"
tags: []

---

# ✅ File Logging Đã Được Thêm Vào Backend

## Thay đổi:

### 1. Updated Logger (`src/utils/logger.ts`)
- ✅ Tự động ghi log ra file (cả development và production)
- ✅ 2 file logs:
  - `logs/server.log` - TẤT CẢ logs (debug, info, warn, error)
  - `logs/error.log` - CHỈ error logs
- ✅ Auto-rotation: 10MB per file, giữ 5 files gần nhất
- ✅ Log level: `debug` (chi tiết nhất)

### 2. Log Format
```
2026-05-01 10:05:00 [info]: 🚀 API Server running on http://localhost:3001
2026-05-01 10:05:00 [info]: Testing connections...
2026-05-01 10:05:01 [info]: ✅ All services connected successfully
2026-05-01 10:05:15 [info]: POST /api/query {"ip":"::1"}
```

## Bây giờ bạn có thể:

### 1. Start Server
```bash
cd E:\project\webrag\apps\api
yarn dev
```

### 2. Đọc Logs
Server sẽ tự động tạo file:
- `E:\project\webrag\apps\api\logs\server.log`
- `E:\project\webrag\apps\api\logs\error.log`

### 3. Gửi Log Cho Tôi
Sau khi start server, chạy:
```bash
# Copy toàn bộ log
type E:\project\webrag\apps\api\logs\server.log

# Hoặc chỉ 50 dòng đầu
type E:\project\webrag\apps\api\logs\server.log | head -50
```

Paste nội dung log vào chat, tôi sẽ phân tích xem:
- ✅ Server có start thành công không
- ✅ Supabase có connect được không
- ✅ Ollama có connect được không
- ❌ Có lỗi gì không

## Log sẽ chứa:
- Server startup messages
- Connection test results (Supabase + Ollama)
- All HTTP requests
- RAG retrieval details
- LLM generation details
- Errors (nếu có)
- Audit log writes

Sẵn sàng! Bạn start server và gửi log cho tôi nhé! 🚀
