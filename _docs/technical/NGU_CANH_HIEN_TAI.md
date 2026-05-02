# Ngữ cảnh hiện tại — WebRAG Medical System

**Ngày cập nhật:** 2026-05-01
**Trạng thái:** Sprint 0 — Setup cơ sở hạ tầng

---

## 1. Tổng quan dự án

### Mục tiêu
Xây dựng hệ thống RAG (Retrieval-Augmented Generation) hỗ trợ tri thức nội bộ lâm sàng cho bài toán **viêm phổi Nhi khoa**.

### Nguyên tắc cốt lõi
- **LLM không là mô hình chẩn đoán nguyên phát** — chỉ hỗ trợ tra cứu, giải thích, sinh nháp
- **Human-in-the-loop** — mọi đầu ra quan trọng phải có bác sỹ xác nhận
- **TRIPOD+AI compliant** — tuân thủ hướng dẫn báo cáo AI y tế quốc tế
- **Không hallucination** — trả lời phải có bằng chứng, không đủ nguồn thì từ chối

---

## 2. Kiến trúc hệ thống

### Tech Stack

| Lớp | Công nghệ | Ghi chú |
|-----|-----------|---------|
| Frontend | Next.js 14 (App Router) + React 18 | TypeScript strict |
| Styling | TailwindCSS v4 | Custom medical theme |
| Icons | Lucide React | Consistent, professional |
| i18n | next-intl | Tiếng Việt + English |
| Database | Supabase (PostgreSQL + pgvector) | Vector search cho RAG |
| LLM Server | Ollama (Qwen2.5:7b) | Chạy trên A100 GPU |
| LLM Proxy | Cloudflare Tunnel | Public URL cho dev |
| State | Zustand + TanStack Query | Không Redux |
| Form | React Hook Form + Zod | Schema validation |
| Testing | Playwright (E2E) + Vitest (Unit) | — |

### Kiến trúc Agent (4 agents)

```
┌─────────────────────────────────────────────┐
│              ORCHESTRATOR                    │
│  - Query classification                      │
│  - RBAC enforcement                          │
│  - Route to agent                            │
└─────────────────────────────────────────────┘
                    ↓
    ┌───────────────┼───────────────┐
    ↓               ↓               ↓
┌──────────┐  ┌──────────┐  ┌──────────┐
│ KNOWLEDGE│  │EXPLAINER │  │ REPORTER │
│  AGENT   │  │  AGENT   │  │  AGENT   │
└──────────┘  └──────────┘  └──────────┘

┌─────────────────────────────────────────────┐
│        DOCUMENT SOURCING AGENT (B)          │
│  - Tìm tài liệu y khoa (PubMed, WHO, ...)   │
│  - Đánh giá chất lượng                       │
│  - Chuẩn bị cho RAG ingestion                │
│  - Chạy độc lập, không ảnh hưởng workflow   │
└─────────────────────────────────────────────┘
```

| Agent | Vai trò | Input | Output | Latency target |
|-------|---------|-------|--------|----------------|
| Knowledge | Tra cứu guideline/SOP | Query text | Answer + citations | < 3s |
| Explainer | Giải thích detection model | Detection JSON + clinical data | Explanation + citations | < 5s |
| Reporter | Sinh nháp báo cáo | Template + detection + clinical data | Structured report (JSON) | < 8s |
| Document Sourcing | Tìm & đánh giá tài liệu y khoa | Search query | Candidate documents | Async |

### Detection Schema (đầu vào cho Explainer/Reporter)
```json
{
  "image_id": "abc123",
  "detections": [
    {
      "bbox": [525, 666, 934, 1126],
      "label": "Consolidation",
      "score": 0.81
    },
    {
      "bbox": [154, 435, 346, 627],
      "label": "Pleural effusion",
      "score": 0.67
    }
  ]
}
```

---

## 3. Environment hiện tại

### Supabase
| Thông tin | Giá trị |
|-----------|---------|
| Project URL | `https://mibtdruhmmcatccdzjjk.supabase.co` |
| Anon Key | `sb_publishable_lmqX6atRgaSLPrZdwexcMw_fJU0_04t` |
| Project Ref | `mibtdruhmmcatccdzjjk` |
| Database | PostgreSQL trên Supabase |

### Ollama LLM
| Thông tin | Giá trị |
|-----------|---------|
| Model | `qwen2.5:7b` (Q4_K_M, 4.68 GB) |
| Tốc độ | ~45-54 tokens/s |
| GPU | NVIDIA A100 40GB (đang dùng ~15GB VRAM) |
| Cloudflare URL | `https://grew-hypothesis-mothers-flooring.trycloudflare.com` |
| Local URL | `http://localhost:11434` |

### Lưu ý quan trọng
- Cloudflare Tunnel URL **thay đổi mỗi lần restart** → cần cập nhật `.env`
- Ollama serve phải chạy với `OLLAMA_HOST=0.0.0.0:11434` để expose
- Máy A100 là máy mượn, **không có quyền can thiệp Docker** → không cài vLLM được (CUDA driver cũ)
- Ngrok free plan bị 403 → đã chuyển sang Cloudflare Tunnel

---

## 4. Cấu trúc thư mục

```
webrag/
├── apps/
│   └── web/                          # Frontend Next.js
│       ├── src/
│       │   ├── app/                  # Next.js App Router
│       │   │   ├── layout.tsx        ✅ Root layout
│       │   │   ├── page.tsx          ✅ Home page
│       │   │   ├── query/page.tsx    ✅ Stub
│       │   │   ├── explain/page.tsx  ✅ Stub
│       │   │   ├── draft/page.tsx    ✅ Stub
│       │   │   ├── knowledge/page.tsx ✅ Stub
│       │   │   └── admin/page.tsx    ✅ Stub
│       │   ├── components/
│       │   │   ├── ui/
│       │   │   │   ├── app-layout.tsx ✅ Layout wrapper
│       │   │   │   ├── header.tsx     ✅ Header + lang selector
│       │   │   │   └── sidebar.tsx    ✅ Sidebar navigation
│       │   │   └── screens/          ❌ Chưa có
│       │   ├── lib/
│       │   │   ├── supabase/         ❌ Chưa có
│       │   │   ├── ollama/           ❌ Chưa có
│       │   │   ├── agents/           ❌ Chưa có
│       │   │   └── i18n/             ❌ Chưa có
│       │   ├── locales/
│       │   │   ├── vi/messages.json  ✅ Translation tiếng Việt
│       │   │   └── en/messages.json  ✅ Translation tiếng Anh
│       │   └── styles/
│       │       └── globals.css       ✅ Medical design tokens
│       ├── package.json              ✅ Dependencies
│       ├── tsconfig.json             ✅ TypeScript config
│       ├── next.config.js            ✅ Next.js config
│       ├── postcss.config.js         ✅ PostCSS config
│       └── .env.local                ❌ Chưa tạo (có ở root .env)
│
├── _docs/
│   ├── technical/
│   │   └── SETUP.md                  ✅ Hướng dẫn setup
│   ├── notes/                        📁 Trống
│   ├── screenshots/                  📁 Trống
│   └── debug/                        📁 Trống
├── _tests/                           📁 Trống
├── docs/                             ✅ Specs có sẵn
│   ├── yeu_cau_he_thong_rag.md       ✅ Yêu cầu hệ thống
│   ├── mvp_ui_ux_plan.md             ✅ Kế hoạch MVP UI/UX
│   ├── prd_ui_flow_y_te_rag.md       ✅ PRD
│   ├── wireflow_screen_by_screen_ui_rag.md ✅ Wireflow
│   ├── pcxr_detector_pipeline.schema.json ✅ Schema detection
│   └── pcxr_post_processing_spec.md  ✅ Post-processing spec
├── docs_agent/                       ✅ Templates làm việc
│   ├── template_quy_tac_phat_trien.md ✅ Quy chế phát triển
│   ├── template_quy_tac_lam_viec_nhom.md ✅ Quy tắc nhóm
│   └── template_nhac_nho.md          ✅ Template nhắc nhở
├── note/                             ✅ Notes có sẵn
│   ├── de_cuong_nghien_cuu.md        ✅ Đề cương nghiên cứu
│   ├── tripodAI.md                   ✅ TRIPOD+AI guidance
│   └── IMPLEMENTATION_SUMMARY.md     ✅ Summary cũ
├── .env                              ✅ Credentials (root)
├── package.json                      ✅ Root package (Supabase SDK)
├── test-supabase.js                  ✅ Test kết nối Supabase
├── test-ollama-rag.js                ✅ Test Ollama RAG
└── README.md                         ✅ File đầu tiên
```

**Ký hiệu:** ✅ Đã có | ❌ Chưa làm | 📁 Thư mục trống

---

## 5. Design System

### Màu sắc (Medical-grade)

| Token | Giá trị | Sử dụng |
|-------|---------|---------|
| Brand Primary | `hsl(217 91% 60%)` | Primary actions, links |
| Brand Light | `hsl(213 94% 94%)` | Backgrounds, active nav |
| AI (Purple) | `hsl(262 83% 58%)` | AI-generated content badge |
| Human (Green) | `hsl(160 84% 39%)` | Human-verified badge |
| Warning (Amber) | `hsl(45 93% 47%)` | Cảnh báo, pending |
| Error (Red) | `hsl(0 84% 60%)` | Lỗi nghiêm trọng |
| Citation (Yellow) | `hsl(252 95% 96%)` | Background citation |
| Text Primary | `hsl(222 47% 11%)` | Nội dung chính |
| Text Secondary | `hsl(220 9% 46%)` | Label, caption |

### Typography
- **Font:** Inter (có hỗ trợ Vietnamese)
- **Size:** 16px base, line-height 1.5
- **Max 2 weights/component** (normal + semibold)

### Spacing
- **Base unit:** 4px
- **Scale:** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64
- **Không dùng số lẻ**

### Border Radius
- **Mặc định:** 6px (0.375rem) — vuông vức, chuyên nghiệp
- **Cards:** 8px (0.5rem)
- **Badges:** Full (pill)

### Triết lý UI
- **Ưu tiên vuông vức** — chuẩn hành chính y tế
- **Không landing page style** — phải như phần mềm enterprise
- **Information density cao** — bác sỹ cần nhiều thông tin
- **Safety visible** — cảnh báo luôn nổi bật
- **Không hiển thị chain-of-thought** trên UI

---

## 6. Supabase Schema (đã định nghĩa, chưa implement)

### Bảng cần tạo
| Bảng | Mục đích |
|------|----------|
| `documents` | Kho tri thức (guideline, SOP, protocol) |
| `document_chunks` | Vector embeddings cho retrieval |
| `document_versions` | Lịch sử phiên bản tài liệu |
| `audit_logs` | Nhật ký truy cập, truy vấn |
| `users` / `profiles` | RBAC (4 roles: clinician, radiologist, researcher, admin) |
| `query_sessions` | Phiên truy vấn RAG |
| `draft_reports` | Nháp báo cáo |
| `report_templates` | Registry form báo cáo |
| `document_sourcing_queue` | Queue tìm tài liệu y khoa |
| `document_candidates` | Ứng viên chờ duyệt |
| `feedback_logs` | Phản hồi người dùng (accept/edit/reject) |

---

## 7. Việc đã hoàn thành ✅

- [x] Nghiên cứu yêu cầu hệ thống (3 docs chính)
- [x] Chốt kiến trúc 4 agents + orchestrator
- [x] Setup Ollama + Cloudflare Tunnel trên A100
- [x] Test kết nối Supabase thành công
- [x] Test Ollama generation thành công (~54 tokens/s)
- [x] Tạo cấu trúc thư mục Next.js
- [x] Cài đặt dependencies (Next.js 14, React 18, TypeScript, TailwindCSS v4)
- [x] Tạo design tokens (CSS variables, medical theme)
- [x] Tạo layout cơ bản (Header + Sidebar + Content)
- [x] Tạo stub pages cho 5 routes
- [x] Tạo translation files (vi/en)
- [x] Viết tài liệu SETUP.md

---

## 8. Việc chưa làm ❌

### Ưu tiên cao (Sprint tiếp theo)
- [ ] **Build base UI components**: Button, Card, Badge, Alert, Skeleton, Spinner
- [ ] **Tạo Supabase client**: `lib/supabase/client.ts` + `lib/supabase/server.ts`
- [ ] **Tạo Ollama client**: `lib/ollama/client.ts` với retry, timeout, error handling
- [ ] **Setup i18n provider**: Tích hợp next-intl vào layout
- [ ] **Tạo .env.local**: Copy credentials từ root .env
- [ ] **Chạy dev server**: Test layout thực tế, fix warnings/errors

### Ưu tiên trung bình
- [ ] **Knowledge Agent**: Implement retrieval + citation
- [ ] **Explainer Agent**: Parse detection + generate explanation
- [ ] **Reporter Agent**: Template-based report generation
- [ ] **Document Sourcing Agent**: PubMed/WHO API integration
- [ ] **Guardrails layer**: No-diagnosis, no-treatment, refuse-safely
- [ ] **RBAC middleware**: Route protection theo vai trò

### Ưu tiên thấp (Phase sau)
- [ ] **Audit logging**: Ghi log mọi truy vấn
- [ ] **Dashboard vận hành**: Monitoring, drift detection
- [ ] **Champion/Challenger mode**: Multi-model comparison
- [ ] **E2E tests**: Playwright cho happy path + safety path
- [ ] **Storybook**: Component documentation
- [ ] **CI/CD pipeline**: GitHub Actions

---

## 9. Quy trình làm việc (theo quy chế)

1. **Mỗi task** → branch mới
2. **Code xong** → chạy dev server, test trực tiếp
3. **Screenshot** → lưu vào `_docs/screenshots/`
4. **Debug notes** → lưu vào `_docs/debug/`
5. **Không warning/error** → commit
6. **Commit message** → rõ ràng, theo convention
7. **AI sinh code** → người review trước khi merge
8. **Mọi thay đổi** → có người chịu trách nhiệm cuối cùng

---

## 10. Rủi ro & Lưu ý

| Rủi ro | Mức độ | Ghi chú |
|--------|--------|---------|
| Cloudflare URL thay đổi | Cao | Mỗi lần restart tunnel → phải update .env |
| VRAM không đủ cho 7B model | Trung | Hiện tại 15GB free, model cần ~8GB |
| Không có quyền Docker trên A100 | Cao | Phải dùng Ollama (đã setup), không dùng vLLM |
| Ngrok free bị 403 | Trung bình | Đã chuyển sang Cloudflare |
| Model hallucination | Cao | Cần guardrails + citation enforcement |
| Schema drift frontend/backend | Trung bình | OpenAPI làm source of truth |
| Missing translation keys | Thấp | next-intl sẽ warning lúc build |

---

## 11.下一步 — Immediate next actions

1. **Build base UI components** (Button, Card, Badge, Alert)
2. **Tạo Supabase + Ollama clients** trong `lib/`
3. **Setup .env.local** và test dev server
4. **Screenshot UI** → lưu vào `_docs/screenshots/`
5. **Fix tất cả warnings** trước khi commit
6. **Implement Knowledge Agent** — agent đơn giản nhất

---

*Tài liệu này sẽ được cập nhật sau mỗi sprint retro.*
