# Hướng dẫn Setup — WebRAG Medical System

## Ngày tạo: 2026-05-01

## 1. Cấu trúc Project

```
webrag/
├── apps/
│   └── web/                    # Frontend Next.js
│       ├── src/
│       │   ├── app/            # Next.js App Router (routes)
│       │   ├── components/     # UI Components
│       │   │   ├── ui/         # Base components (button, card, etc.)
│       │   │   └── screens/    # Page-level components
│       │   ├── lib/            # Business logic
│       │   │   ├── supabase/   # Supabase client & queries
│       │   │   ├── ollama/     # Ollama API client
│       │   │   ├── agents/     # Agent orchestration
│       │   │   └── i18n/       # Internationalization
│       │   ├── locales/        # Translation files
│       │   └── styles/         # Global CSS + Tailwind theme
│       ├── public/             # Static assets
│       ├── .env.local          # Environment variables
│       └── package.json
├── _docs/
│   ├── technical/              # Technical documentation
│   ├── notes/                  # Meeting notes, decisions
│   ├── screenshots/            # UI screenshots for review
│   └── debug/                  # Debug logs
├── _tests/                     # Test files
├── docs/                       # Existing specs
└── note/                       # Existing notes
```

## 2. Tech Stack

- **Frontend**: Next.js 14 (App Router) + React 18
- **Styling**: TailwindCSS v4 + custom medical theme
- **Icons**: Lucide React
- **i18n**: next-intl (Vietnamese + English)
- **Database**: Supabase (PostgreSQL + pgvector)
- **LLM**: Ollama (Qwen2.5:7b) via Cloudflare Tunnel

## 3. Design System

### Colors
- Primary: Medical blue (`hsl(217 91% 60%)`)
- AI content: Purple (`hsl(262 83% 58%)`)
- Human verified: Green (`hsl(160 84% 39%)`)
- Warning: Amber (`hsl(45 93% 47%)`)
- Citations: Yellow (`hsl(252 95% 96%)`)

### Typography
- Font: Inter (with Vietnamese support)
- Size: 16px base, 1.5 line-height

### Spacing
- Base unit: 4px
- Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64

### Border Radius
- Minimal: 0.375rem (6px) default
- Cards: 0.5rem (8px)
- Badges: Full (pill)

## 4. Cài đặt Dependencies

```bash
cd apps/web
yarn install
```

## 5. Chạy Development

```bash
cd apps/web
yarn dev
```

Truy cập: http://localhost:3000

## 6. Environment Variables

Tạo file `apps/web/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://mibtdruhmmcatccdzjjk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_lmqX6atRgaSLPrZdwexcMw_fJU0_04t
NEXT_PUBLIC_OLLAMA_URL=https://grew-hypothesis-mothers-flooring.trycloudflare.com
```

## 7. Quy trình làm việc

1. Tạo branch mới cho mỗi task
2. Code → Test → Screenshot
3. Lưu screenshot vào `_docs/screenshots/`
4. Ghi debug notes vào `_docs/debug/`
5. Không có warning/error → Commit
6. Push lên Git

## 8. Các Agent đã định nghĩa

| Agent | Vai trò | Input | Output |
|-------|---------|-------|--------|
| Knowledge | Tra cứu guideline | Query text | Answer + citations |
| Explainer | Giải thích detection | Detection JSON | Explanation + citations |
| Reporter | Sinh nháp báo cáo | Template + data | Structured report |
| Document Sourcing | Tìm tài liệu y khoa | Search query | Candidate documents |

## 9. Supabase Schema (đã tạo)

- `documents` — Kho tri thức
- `document_chunks` — Vector embeddings
- `audit_logs` — Truy vết
- `users` / `profiles` — RBAC
- `query_sessions` — Phiên truy vấn
- `draft_reports` — Nháp báo cáo
- `document_sourcing_queue` — Queue tìm tài liệu
- `document_candidates` — Ứng viên chờ duyệt

## 10. Ollama API Endpoint

- URL: `https://grew-hypothesis-mothers-flooring.trycloudflare.com`
- Model: `qwen2.5:7b`
- Tốc độ: ~45-54 tokens/s
- API: OpenAI-compatible
