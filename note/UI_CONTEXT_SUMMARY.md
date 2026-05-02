---
noteId: "253dbe70453611f1b3ce19fa7351e6bb"
tags: []

---

# agentUI — Tóm tắt toàn bộ ngữ cảnh
> Cập nhật: 01/05/2026 15:14 | Agent: agentUI (Sonnet 4.6) | Vai trò: UI/UX Next.js

---

## 1. Dự án là gì

**Tên:** RAG_BVNHIDONG  
**Mục tiêu:** Hệ thống hỗ trợ chẩn đoán viêm phổi nhi bằng AI — **không phải** công cụ chẩn đoán chính, **là** công cụ hỗ trợ bác sĩ đọc X-quang ngực.  
**Mô hình hoạt động:** Doctor-in-the-loop, TRIPOD+AI compliant, không hallucination.  
**Bệnh viện:** BVNHI Đồng (Nhi đồng), TP.HCM.

### Đường dẫn quan trọng
| File | Nội dung |
|------|---------|
| `E:\project\webrag\_docs\technical\NGU_CANH_HIEN_TAI.md` | Tổng quan dự án, tech stack, tiến độ, pending tasks |
| `E:\project\webrag\_docs\technical\SETUP.md` | Hướng dẫn cài đặt, cấu trúc project |
| `E:\project\webrag\note\de_cuong_nghien_cuu.md` | Đề cương nghiên cứu: kiến trúc sâu, MLOps, KPI, roadmap |
| `E:\project\webrag\docs\yeu_cau_he_thong_rag.md` | Yêu cầu hệ thống chi tiết (functional, safety, privacy...) |
| `E:\project\webrag\.env` | Credentials Supabase + Ollama (không commit) |
| `E:\project\webrag\note\agent_chat\chat1.md` | File liên lạc giữa các agent |

---

## 2. Tech stack

| Lớp | Công nghệ |
|-----|-----------|
| Frontend | Next.js 14.2 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS v4, PostCSS `@tailwindcss/postcss` |
| Icons | Lucide React |
| Package manager | Yarn (workspace: `apps/web`) |
| Database | Supabase (PostgreSQL + pgvector) |
| LLM | Ollama — model `qwen2.5:7b`, GPU A100, Cloudflare Tunnel |
| i18n | `next-intl` (installed, chưa integrate) |

### Environment variables (`.env` root)
```
NEXT_PUBLIC_SUPABASE_URL=https://mibtdruhmmcatccdzjjk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_lmqX6atRgaSLPrZdwexcMw_fJU0_04t
DATABASE_URL=postgresql://postgres:***@db.mibtdruhmmcatccdzjjk.supabase.co:5432/postgres
OLLAMA_URL=https://grew-hypothesis-mothers-flooring.trycloudflare.com
```
> `apps/web/.env.local` cần copy từ `.env` để Next.js đọc được `NEXT_PUBLIC_*`

### Chạy dev
```bash
cd E:\project\webrag\apps\web
yarn dev      # → http://localhost:3000
```

---

## 3. Cấu trúc file UI đã tạo

```
apps/web/src/
├── app/
│   ├── layout.tsx              # Root layout — Inter font, AppLayout wrapper
│   ├── page.tsx                # Worklist (homepage)
│   └── cases/
│       ├── new/page.tsx        # Tạo ca mới — multi-file upload
│       └── [id]/page.tsx       # Case detail — 3-step viewer
├── components/ui/
│   ├── app-layout.tsx          # Shell: Header + ContextBar + Sidebar + main
│   ├── header.tsx              # Top bar: branding, system status, model info
│   ├── sidebar.tsx             # Nav: Worklist, Knowledge, Admin + "Tạo ca mới"
│   └── context-bar.tsx         # Breadcrumb/context + safety notices
└── styles/
    └── globals.css             # Tailwind v4 @theme tokens (color system)
```

### Public assets
```
apps/web/public/pcxr/           # 10 ảnh PCXR thật (1280×1280 PNG)
  01_imgid_336_*.png … 10_imgid_96_*.png
```
Nguồn: `E:\project\webrag\note\pcxr_visualize_10_samples\images_raw\`

---

## 4. Design system (Tailwind v4 tokens)

Định nghĩa trong `globals.css` → `@theme { ... }`:

| Token | Giá trị | Dùng cho |
|-------|---------|---------|
| `--color-text-primary` | `hsl(222 47% 5%)` | Text chính |
| `--color-text-secondary` | `hsl(220 13% 28%)` | Text phụ |
| `--color-text-tertiary` | `hsl(220 9% 50%)` | Label, placeholder |
| `--color-background` | `hsl(210 20% 98%)` | Nền trang |
| `--color-surface` | `hsl(0 0% 100%)` | Card, panel |
| `--color-border` | `hsl(220 13% 82%)` | Đường viền |
| `--color-brand-primary` | `hsl(220 90% 50%)` | Action, accent |
| `--color-brand-light` | `hsl(220 90% 95%)` | Hover bg của brand |
| `--color-semantic-error` | `hsl(0 84% 50%)` | Lỗi, severity cao |
| `--color-semantic-warning` | `hsl(38 92% 50%)` | Cảnh báo |
| `--color-semantic-success` | `hsl(142 71% 40%)` | Thành công, approved |

**Nguyên tắc màu:** Không dùng màu trang trí. Màu chỉ mang ý nghĩa semantic (xanh = brand, đỏ = error, vàng = warning, xanh lá = success). Nền trắng/xám, text đủ contrast.

---

## 5. Các trang đã implement

### 5.1 Worklist (`/`) — `page.tsx`
**Client component** với state management.

**Tính năng:**
- Bảng danh sách ca (Episode) với mock data 5 cases
- Stats cards: Tổng / Đang xử lý / Chờ duyệt / Hoàn thành (tính động từ state)
- Filter tabs: Tất cả / Đang xử lý / Hoàn thành (counts động)
- Status indicator: `pending_detection` hiện spinner Loader2 đang quay
- **Polling simulation:** EP-2024-008 (pending_detection) tự động chuyển sang `pending_explain` sau 8 giây — mô phỏng PCXR detection xong
- Countdown đến lần refresh tiếp theo (30s)
- Nút "Tạo ca mới" → `/cases/new`
- Click row → `/cases/{id}`

**Mock case statuses:**
```
EP-2024-010 → pending_explain   (2 findings)
EP-2024-009 → pending_draft     (1 finding)
EP-2024-008 → pending_detection → pending_explain sau 8s
EP-2024-007 → pending_approval  (1 finding)
EP-2024-006 → completed
```

---

### 5.2 Tạo ca mới (`/cases/new`) — `cases/new/page.tsx`
**Client component.**

**Layout:** Drop zone bên trái (264px) + Form bên phải (flex-1).

**Tính năng:**
- Drag & drop hoặc click chọn file — nhận nhiều file cùng lúc
- Filter: chỉ nhận PNG / JPG / DICOM (`.dcm`), tối đa 10MB/file
- Danh sách file đã chọn với progress bar (% trường đã điền)
- Click vào file trong danh sách → chuyển form bên phải sang file đó
- Nút xóa file riêng lẻ
- Form thông tin bệnh nhân: Mã BN, Tuổi, Giới tính, Ngày chụp, Khoa
- Form lâm sàng: Triệu chứng, Số ngày bệnh, SpO₂, Nhiệt độ
- Form xét nghiệm (không bắt buộc): CRP, WBC
- Indicator hoàn thành điền form cho từng file
- Submit: spinner → navigate sang `/cases/EP-2024-010?step=detection`

---

### 5.3 Case Detail (`/cases/[id]`) — `cases/[id]/page.tsx`
**Client component.** Đây là màn hình trung tâm của toàn bộ workflow bác sĩ.

#### Layout tổng thể
```
┌─────────────────────────────────────────────────────────────────┐
│ ← Worklist   EP-2024-010 · 3t · 01/05  [▐▐▌][▐▌▌][▌▌▐] [Det●][Exp][Dft] │
├──────────────────────────┬──────────────────────────────────────┤
│                          │                                      │
│   IMAGE PANEL            │   CONTENT PANEL (step-based)        │
│   width: 54/44/30%       │   width: flex-1                     │
│                          │                                      │
│   [X-ray viewer]         │   Detection / Explain / Draft       │
│   [bbox overlays]        │                                      │
│   [legend]               │                                      │
│   ─────────────          │                                      │
│   [Patient info]         │                                      │
│   [collapsible]          │                                      │
└──────────────────────────┴──────────────────────────────────────┘
```

#### Panel width presets (top right)
| Glyph | Mode | Image% | Content% | Auto-switch khi |
|-------|------|--------|----------|-----------------|
| `▐▐▌` | wide | 54% | 46% | Step Detection |
| `▐▌▌` | balanced | 44% | 56% | Step Explain |
| `▌▌▐` | compact | 30% | 70% | Step Draft |
> Manual override: click preset → không auto-switch khi chuyển step nữa.

#### Image viewer (XrayViewport)
- **ResizeObserver** đo không gian thực sự available → vẽ square `min(containerWidth, containerHeight)`
- Không bao giờ gây scroll dọc
- Ảnh PCXR thật từ `/public/pcxr/` — `object-fit: cover`
- **Bounding boxes** từ real label data (JSON labels, format `bbox_xywh` pixels trong 1280×1280)
- Bbox position = pixel / 1280 * 100% → luôn căn chỉnh đúng
- **Corner dots** ở 4 góc mỗi bbox
- **Label tag** trên bbox: tên tìm kiếm ngắn + confidence %
- Hover finding → bbox highlight (và ngược lại từ content panel)
- **Sample picker 1–10** trong toolbar: switch sang ảnh khác ngay lập tức
- **Fullscreen button** (Maximize2) → overlay toàn màn hình
- **Legend bar** dưới ảnh: click/hover từng annotation

#### 10 PCXR samples thật
| # | imageId | Annotations | Category |
|---|---------|-------------|---------|
| 1 | imgid_336 | 1 | Peribronchovascular interstitial opacity |
| 2 | imgid_70 | 1 | Expanded edges of the anterior ribs |
| 3 | imgid_856 | 2 | Reticulonodular opacity (bilateral) |
| 4 | imgid_750 | 1 | Peribronchovascular interstitial opacity |
| 5 | imgid_660 | 2 | Peribronchovascular interstitial opacity |
| 6 | imgid_416 | 1 | Cardiomegaly |
| 7 | imgid_317 | 2 | Reticulonodular opacity |
| 8 | imgid_284 | 1 | Bronchial thickening |
| 9 | imgid_1300 | 3 | Cardiomegaly + Peribronchovascular (×2) |
| 10 | imgid_96 | 2 | Peribronchovascular + Reticulonodular |

Label data: `E:\project\webrag\note\pcxr_visualize_10_samples\labels_json\`

#### Step 1: Detection
- Findings list: tên VN + tên EN, vùng tổn thương, ghi chú, confidence %
- Màu bar và badge theo severity (high=red/medium=yellow)
- Hover finding ↔ highlight bbox trên ảnh (bidirectional)
- Warning notice về giới hạn AI
- Nút "Yêu cầu giải thích lâm sàng" → Step 2

#### Step 2: Explain
- **Trạng thái idle:** placeholder + nút "Chạy Explainer Agent"
- **Streaming:** text xuất hiện từng token (16ms/token), cursor nhấp nháy
- **Done state:**
  - Text đầy đủ với inline citations `[1]` `[2]` `[3]` là button clickable
  - Click `[N]` → `CitationPopup` floating card góc phải màn hình:
    - Tên tài liệu + section
    - Đoạn trích nguyên văn (blockquote)
    - Thanh progress độ liên quan (%)
    - Link "Mở trong Knowledge Base"
  - Danh sách citations bên dưới text — cũng clickable (full row)
  - **Feedback bar:** ThumbsUp "Chấp nhận" / ThumbsDown "Không phù hợp" / "Chạy lại"
- **Inline chat (Knowledge Agent):**
  - 2 gợi ý câu hỏi mặc định
  - Input + Send (Enter)
  - Mock replies có context lâm sàng (WHO, BTS, safety gate từ chối kê đơn)
  - Loading indicator
- Nút "Tiếp tục — Sinh nháp báo cáo" → Step 3

#### Step 3: Draft
- **Trạng thái idle:** nút "Sinh nháp báo cáo"
- **Generating:** streaming preview text font mono + cursor
- **Done state:**
  - Form 5 trường với 3 loại: `AI đề xuất` / `BS điền *` (required) / `Chỉ đọc`
  - Trường đã sửa hiện badge "● Đã sửa" + nền xanh nhạt
  - **Chat điều chỉnh** (bên phải, 224px):
    - 3 lệnh gợi ý
    - Gõ lệnh tự nhiên → Agent parse → tạo `PendingChange`
    - **Diff overlay** trực tiếp trên trường: nội dung cũ gạch ngang + nội dung mới + Chấp nhận/Bỏ qua
  - **Nút "BS Xác nhận & Lưu"** → form lock, banner "Đã duyệt · Audit trail ghi nhận"
  - Nút "Xuất PDF" (disabled, placeholder)

#### Fullscreen viewer
- `fixed inset-0 bg-zinc-950 z-50`
- Header: imageId + patient info + nút đóng
- `XrayViewport` dùng cùng ResizeObserver → max square trong viewport trừ header/footer
- Footer: legend bar hover → highlight bbox
- Đóng bằng `Esc` key hoặc nút `[Esc ×]`

---

## 6. Các lỗi đã fix trong session này

| Lỗi | Nguyên nhân | Fix |
|-----|-------------|-----|
| `yarn dev` từ root báo lockfile error | Phải chạy từ `apps/web`, không phải root | `cd apps/web; yarn dev` |
| `&&` không dùng được trong PowerShell | PowerShell dùng `;` thay `&&` | `cd apps/web; yarn dev` |
| Tailwind PostCSS error | Tailwind v4 tách plugin riêng | Cài `@tailwindcss/postcss`, sửa `postcss.config.js` |
| Màn hình trắng + 500 error | `output: 'standalone'` conflict | Xóa khỏi `next.config.js` |
| Hydration warning `body` | Browser extension inject style | Thêm `suppressHydrationWarning` vào `<body>` |
| Image viewer bị kẹp 130px | `aspect-square` + thiếu `h-full` trong layout chain | ResizeObserver + `h-full` trên `div.max-w-7xl` |
| Scroll dọc khi xem ảnh | `aspect-square` mở rộng theo width, vượt viewport | ResizeObserver đo `min(w,h)` → không bao giờ scroll |

---

## 7. Các file config đã thay đổi

### `apps/web/next.config.js`
```js
const nextConfig = { reactStrictMode: true };
module.exports = nextConfig;
// Đã xóa: output: 'standalone', experimental.serverActions
```

### `apps/web/postcss.config.js`
```js
module.exports = {
  plugins: { '@tailwindcss/postcss': {} },
  // Đã xóa: tailwindcss: {}, autoprefixer: {}
};
```

### `apps/web/src/app/layout.tsx`
```tsx
<body className={inter.className} suppressHydrationWarning>
```

### `apps/web/src/components/ui/app-layout.tsx`
```tsx
<div className="max-w-7xl mx-auto p-5 h-full">  {/* h-full bắt buộc */}
```

---

## 8. Các trang/component đã XÓA

| File | Lý do |
|------|-------|
| `src/app/explain/page.tsx` | Tích hợp vào `/cases/[id]?step=explain` |
| `src/app/query/page.tsx` | Tích hợp vào Knowledge Agent chat |
| `src/app/draft/page.tsx` | Tích hợp vào `/cases/[id]?step=draft` |

---

## 9. Những gì còn thiếu (backend cần làm)

| Feature | Mô tả | Agent |
|---------|-------|-------|
| Supabase episodes CRUD | Lưu/đọc episode, findings, report | agentBE |
| API `/api/cases` | Danh sách ca thật thay mock data | agentBE |
| API `/api/cases/[id]/explain` | Gọi Explainer Agent thật | agentBE |
| API `/api/cases/[id]/draft` | Gọi Reporter Agent thật | agentBE |
| API `/api/knowledge/search` | RAG search thật | agentBE |
| PCXR inference API | Gọi model thật, trả bbox JSON | agentML |
| Auth / session | User login, role | agentBE |
| File upload → storage | Supabase Storage hoặc local | agentBE |

### Contract mà agentUI đang chờ
Khi agentBE implement API, agentUI cần biết:
```typescript
// GET /api/cases → Episode[]
// GET /api/cases/:id → EpisodeDetail
// POST /api/cases/:id/detect → DetectionResult { findings: Finding[] }
// POST /api/cases/:id/explain → ExplainResult { text: string, citations: Citation[] }
// POST /api/cases/:id/draft → DraftResult { fields: DraftField[] }
// POST /api/knowledge/search → SearchResult { chunks: Chunk[] }
```

---

## 10. Kiến trúc UI components sắp tới (nếu có task mới)

### Đã xác định cần làm
- [ ] `/knowledge` page — Knowledge Base browser (search, filter by source)
- [ ] `/admin` page — System monitoring (agent status, model info, audit log)
- [ ] Real API integration (thay mock data)
- [ ] Supabase Realtime cho worklist polling thật
- [ ] i18n với next-intl (VN/EN)

### Pattern đang dùng nhất quán
- **Mock data → real API:** thay `MOCK_*` const bằng `useSWR` hoặc `fetch` hook
- **Streaming text:** `streamText()` helper → sẽ thay bằng `fetch` với `ReadableStream`
- **Forms:** tất cả là controlled components với `useState`
- **Layout:** không dùng CSS Grid global, chỉ Flexbox với Tailwind

---

## 11. Multi-agent protocol

**File liên lạc:** `E:\project\webrag\note\agent_chat\chat1.md`

**Quy tắc:**
1. Đọc file trước khi bắt đầu task
2. Ghi `[START]` + mô tả + dấu hiệu nhận biết khi xong
3. Ghi `[DONE]` khi xong
4. File ~500 dòng → tạo `chat2.md`, tóm tắt `chat1.md` ở đầu

**Agents:**
- `agentUI` — file hiện tại (Sonnet 4.6)
- `agentBE` — đang implement API server, Supabase, Agents
- `agentML` — chưa active

---

*File này được tạo bởi agentUI | `E:\project\webrag\note\UI_CONTEXT_SUMMARY.md`*
