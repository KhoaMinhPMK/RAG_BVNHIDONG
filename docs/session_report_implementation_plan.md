# Kế hoạch triển khai: Lưu trữ báo cáo và Lịch sử chat

| Trường | Nội dung |
|---|---|
| Tên tài liệu | Kế hoạch triển khai chi tiết — Chat Session History + Report Storage |
| Phiên bản | 1.0 |
| Ngày tạo | 07/05/2026 |
| Trạng thái | Draft — chờ review kỹ thuật |
| Tài liệu liên quan | `docs/prd_ui_flow_y_te_rag.md`, `docs/cae_integrated_ux_behavior_spec.md` |
| Phụ thuộc hiện tại | `draft_reports` table, `audit_logs` table, `/api/cae/*` routes, `authenticateJWT` + RBAC middleware |

---

## 1. Bối cảnh và động lực

Hệ thống hiện tại (`draft_reports` + `/api/cae/*`) đã xử lý luồng tạo bản nháp từ AI nhưng còn thiếu:

1. **Lịch sử chat**: Mỗi lần refresh trình duyệt, toàn bộ hội thoại với AI mất. Bác sĩ không thể quay lại ngữ cảnh đã xây dựng cho một ca bệnh.
2. **Versioning báo cáo**: `draft_reports` chỉ lưu trạng thái cuối — không có chuỗi lịch sử `v1 → v2 → approved` kèm diff.
3. **Provenance đóng băng**: Khi tài liệu nguồn bị re-ingest hoặc xóa, không có gì bảo vệ citations đã dùng trong báo cáo đã duyệt.
4. **Audit trail hiển thị**: `audit_logs` tồn tại nhưng không được surface lên giao diện người dùng cuối.

Kế hoạch này mở rộng cơ sở hạ tầng hiện có mà không phá vỡ API routes hoặc DB schema đang chạy.

---

## 2. Phạm vi tính năng

### 2.1. Nhóm A — Chat Session History

| ID | Tính năng | Mô tả |
|---|---|---|
| SH-01 | Persistent sessions | Session chat lưu vào Supabase, tồn tại qua refresh và relogin |
| SH-02 | Auto-title | LLM sinh tiêu đề 5-7 từ từ message đầu tiên |
| SH-03 | Session sidebar | Danh sách sessions theo ngày, search, badge trạng thái |
| SH-04 | Session-case binding | Gắn session với `episode_id`, hiện trong Case Detail |
| SH-05 | Fork session | Rẽ nhánh từ một message bất kỳ trong session cũ |
| SH-06 | Context window meter | Hiện % context đã dùng, cảnh báo khi > 85% |
| SH-07 | Sliding window trim | Auto-summarize các turns cũ khi vượt ngưỡng token |
| SH-08 | Message feedback | Thumbs up/down trên mỗi response AI |
| SH-09 | Export session | Xuất toàn bộ Q&A + citations thành PDF / Markdown |

### 2.2. Nhóm B — Report Storage & Versioning

| ID | Tính năng | Mô tả |
|---|---|---|
| RV-01 | Report versions | Mỗi lần chỉnh sửa tạo version mới (immutable) |
| RV-02 | Citation snapshot | Đóng băng `CitationAnchor[]` vào version tại thời điểm tạo |
| RV-03 | Auto-save draft | Lưu liên tục mỗi 30 giây, indicator trạng thái |
| RV-04 | Diff view | So sánh bất kỳ hai version, highlight thêm/xóa/sửa |
| RV-05 | Approval workflow | Gửi duyệt → Duyệt / Trả về với note (extend trạng thái đã có) |
| RV-06 | Supersede flow | Tạo revision mới từ báo cáo đã duyệt, cũ thành `superseded` |
| RV-07 | Export PDF | Kèm watermark trạng thái + QR audit trail |
| RV-08 | Concurrent edit lock | Phát hiện khi 2 người cùng mở, chế độ read-only cho người sau |
| RV-09 | Audit trail UI | Timeline sự kiện hiện ngay trong panel báo cáo |
| RV-10 | Dead citation alert | Cảnh báo khi tài liệu nguồn trong snapshot bị xóa/thay thế |

---

## 3. Kiến trúc dữ liệu

### 3.1. Bảng mới: `chat_sessions`

```sql
create table chat_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users on delete cascade,
  episode_id      text references episodes(episode_id) on delete set null,
  title           text not null default 'Phiên mới',
  status          text not null default 'active'
                  check (status in ('active', 'archived')),
  forked_from_id  uuid references chat_sessions(id) on delete set null,
  forked_at_idx   int,                    -- index của message fork point
  context_summary text,                   -- tóm tắt do LLM sinh khi trim
  token_count     int not null default 0, -- tổng tokens đã dùng trong session
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Indexes
create index idx_chat_sessions_user    on chat_sessions(user_id);
create index idx_chat_sessions_episode on chat_sessions(episode_id);
create index idx_chat_sessions_updated on chat_sessions(updated_at desc);

-- RLS
alter table chat_sessions enable row level security;
create policy "Người dùng chỉ đọc session của mình"
  on chat_sessions for select
  using (auth.uid() = user_id);
create policy "Người dùng tạo session của mình"
  on chat_sessions for insert
  with check (auth.uid() = user_id);
create policy "Người dùng cập nhật session của mình"
  on chat_sessions for update
  using (auth.uid() = user_id);
```

### 3.2. Bảng mới: `chat_messages`

```sql
create table chat_messages (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references chat_sessions(id) on delete cascade,
  idx           int not null,             -- thứ tự trong session (0-based)
  role          text not null check (role in ('user', 'assistant', 'system')),
  content       text not null,
  citations     jsonb,                    -- CitationAnchor[] — chỉ assistant
  retrieved_chunks jsonb,                 -- RetrievedChunk[] raw — audit sâu
  model_id      text,
  policy_version text,
  latency_ms    int,
  token_count   int,
  is_summarized boolean not null default false,  -- đã được fold vào context_summary
  feedback      smallint check (feedback in (-1, 0, 1)),
  feedback_note text,
  created_at    timestamptz not null default now(),
  unique (session_id, idx)
);

-- Full-text search
create index idx_chat_messages_session on chat_messages(session_id, idx);
create index idx_chat_messages_content_fts
  on chat_messages using gin(to_tsvector('simple', content));

-- RLS (qua session owner)
alter table chat_messages enable row level security;
create policy "Đọc message theo session sở hữu"
  on chat_messages for select
  using (exists (
    select 1 from chat_sessions s
    where s.id = session_id and s.user_id = auth.uid()
  ));
```

### 3.3. Bảng mới: `report_versions`

Mở rộng `draft_reports` hiện có bằng bảng versioning riêng (không sửa `draft_reports`):

```sql
create table report_versions (
  id                uuid primary key default gen_random_uuid(),
  draft_id          uuid not null references draft_reports(draft_id) on delete cascade,
  version           int not null,
  blocks            jsonb not null,         -- RenderableBlock[] — nội dung đầy đủ
  citation_snapshot jsonb not null,         -- CitationAnchor[] đóng băng tại thời điểm
  model_id          text,
  policy_version    text,
  action            text not null
                    check (action in (
                      'ai_generated', 'user_edited', 'submitted_for_review',
                      'approved', 'rejected', 'superseded', 'forked'
                    )),
  action_by         uuid references auth.users,
  action_note       text,
  session_id        uuid references chat_sessions(id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (draft_id, version)
);

-- Immutable: không cho phép UPDATE hoặc DELETE
create rule no_update_report_versions as
  on update to report_versions do instead nothing;

-- Indexes
create index idx_report_versions_draft on report_versions(draft_id, version desc);
```

### 3.4. Bảng mới: `report_locks`

Phục vụ concurrent edit detection (RV-08):

```sql
create table report_locks (
  draft_id    uuid primary key references draft_reports(draft_id) on delete cascade,
  locked_by   uuid not null references auth.users,
  locked_at   timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '10 minutes')
);
```

### 3.5. Thêm cột vào `draft_reports` hiện có

```sql
-- Gắn session nguồn gốc với báo cáo
alter table draft_reports add column if not exists session_id uuid
  references chat_sessions(id) on delete set null;

-- Phiên bản hiện tại (foreign key lỏng để tránh circular)
alter table draft_reports add column if not exists current_version int not null default 1;

-- Supersede chain
alter table draft_reports add column if not exists superseded_by uuid
  references draft_reports(draft_id) on delete set null;
```

---

## 4. API Routes mới

Tất cả routes bên dưới áp dụng `authenticateJWT` + RBAC theo pattern hiện tại.

### 4.1. `/api/sessions` — Chat Sessions

```
POST   /api/sessions            Tạo session mới (tùy chọn episode_id)
GET    /api/sessions            Danh sách sessions của user (phân trang, filter)
GET    /api/sessions/:id        Chi tiết session + messages
PATCH  /api/sessions/:id        Cập nhật title / status
DELETE /api/sessions/:id        Soft delete (status = 'archived')

POST   /api/sessions/:id/fork   Fork từ message index bất kỳ
POST   /api/sessions/:id/export Xuất session thành PDF / Markdown

GET    /api/sessions/:id/messages          Danh sách messages (phân trang)
POST   /api/sessions/:id/messages          Gửi message (gọi CAE agent, SSE stream)
PATCH  /api/sessions/:id/messages/:msgId   Cập nhật feedback
```

**Chi tiết `POST /api/sessions/:id/messages`**:

Route này là wrapper mỏng xung quanh `/api/cae/chat` đã có — thêm logic lưu message vào `chat_messages` trước và sau khi stream. Không rewrite CAE agent.

```typescript
// Luồng xử lý:
// 1. Validate session ownership
// 2. Lưu user message → chat_messages (idx = max_idx + 1)
// 3. Build context: lấy messages không bị summarize + context_summary
// 4. Kiểm tra token budget → trigger summarization nếu cần
// 5. Forward sang streamChat() (đã có trong agents/cae.ts)
// 6. Khi stream kết thúc: lưu assistant message với citations
// 7. Cập nhật session.token_count + session.updated_at
// 8. Trigger auto-title nếu session.title == 'Phiên mới' và đây là lần đầu
```

### 4.2. `/api/reports` — Report Versioning

```
GET    /api/reports                     Danh sách báo cáo (filter by episode/status)
GET    /api/reports/:draftId            Chi tiết + version hiện tại
GET    /api/reports/:draftId/versions   Danh sách tất cả versions
GET    /api/reports/:draftId/versions/:v  Nội dung version cụ thể
GET    /api/reports/:draftId/diff?from=1&to=3  Diff giữa hai versions

POST   /api/reports                     Tạo báo cáo từ session / từ đầu
PATCH  /api/reports/:draftId            Lưu chỉnh sửa (tạo version mới)
POST   /api/reports/:draftId/submit     Gửi duyệt
POST   /api/reports/:draftId/approve    Duyệt (role: reviewer+)
POST   /api/reports/:draftId/reject     Trả về với note (role: reviewer+)
POST   /api/reports/:draftId/supersede  Tạo revision mới
POST   /api/reports/:draftId/export     Xuất PDF

GET    /api/reports/:draftId/lock       Kiểm tra lock
POST   /api/reports/:draftId/lock       Lấy lock (10 phút)
DELETE /api/reports/:draftId/lock       Giải phóng lock
```

**Luồng `PATCH /api/reports/:draftId`** (auto-save):

```typescript
// Body: { blocks: RenderableBlock[], auto?: boolean }
// 1. Kiểm tra lock — nếu locked_by != user → 409 Conflict
// 2. Lấy current_version từ draft_reports
// 3. Insert vào report_versions với version = current_version + 1
// 4. Update draft_reports.current_version + draft_reports.updated_at
// 5. Nếu auto=true: không log vào audit_logs (tránh spam)
// 6. Nếu auto=false: log action 'user_edited' vào audit_logs
```

### 4.3. Auto-title endpoint (nội bộ)

```
POST /api/sessions/:id/auto-title
```

Được gọi nội bộ sau turn đầu tiên. Dùng LLM với prompt ngắn:

```
Tóm tắt câu hỏi sau thành tiêu đề 5-7 từ bằng tiếng Việt, không dùng dấu chấm hỏi:
"{first_user_message}"
```

---

## 5. Context Window Management

### 5.1. Chiến lược sliding window

```
Tổng context budget: 4096 tokens (configurable)
  - System prompt:     ~400t  (cố định)
  - Policy context:    ~800t  (cố định theo ca)
  - RAG chunks:       ~1600t  (per-turn retrieve)
  - Session history:  ~1000t  (phần động — cần quản lý)
  - User message:      ~200t  (per-turn)
  - Response buffer:   ~096t
```

### 5.2. Thuật toán

```
Khi chuẩn bị context cho turn mới:
1. Lấy tất cả messages chưa summarize (is_summarized = false)
2. Tính tổng token_count
3. Nếu tổng > SESSION_HISTORY_BUDGET (mặc định: 1000t):
   a. Lấy N messages cũ nhất đang vượt ngân sách
   b. Gọi LLM để summarize thành đoạn văn
   c. Lưu summary vào chat_sessions.context_summary
   d. Mark các messages đó: is_summarized = true
4. Build context: [context_summary (nếu có)] + [messages chưa summarize]
```

### 5.3. Prompt summarization

```
Tóm tắt cuộc hội thoại dưới đây thành đoạn văn ngắn (tối đa 150 từ),
giữ lại: (1) các quyết định lâm sàng đã được xác nhận,
         (2) citations quan trọng đã được tham chiếu,
         (3) context bệnh nhân đã thiết lập.
Bỏ qua: các câu hỏi làm rõ, phép lịch sự, nội dung lặp.

[messages cần summarize]
```

---

## 6. Thiết kế giao diện

### 6.1. Session Sidebar — Component `ChatSessionSidebar`

**Vị trí**: Slideout từ cạnh trái, trigger từ icon trong nav.

```
Cấu trúc component:
ChatSessionSidebar
  ├── SearchInput (debounce 300ms, search trên title + content)
  ├── NewSessionButton
  ├── SessionGroup (grouped by: hôm nay / hôm qua / tuần này / cũ hơn)
  │     └── SessionItem
  │           ├── StatusDot (active = xanh nhạt)
  │           ├── Title (truncate 1 dòng)
  │           ├── Meta (số turns · số nguồn · giờ)
  │           ├── ReportBadge (nếu session có report đã duyệt)
  │           └── ContextMenu [Đặt tên lại | Fork | Xuất | Lưu trữ]
  └── Footer (link sang trang Archive)
```

**States**:

| State | Hiển thị |
|---|---|
| Đang tải | Skeleton 5 items |
| Không có session | "Bắt đầu cuộc hội thoại đầu tiên" + nút tạo |
| Không tìm thấy | "Không tìm thấy phiên nào phù hợp" |
| Lỗi tải | "Không thể tải lịch sử — [Thử lại]" |

---

### 6.2. Chat Panel — Tích hợp vào Case Detail

**Thay đổi layout Case Detail** (`apps/web/src/app/cases/[id]/page.tsx`):

```
Hiện tại:
  [X-ray Viewer] | [CAE/Explain Panel + EvidenceRail]

Sau:
  [X-ray Viewer] | [CAE/Explain Panel + EvidenceRail] | [Chat Panel]
                                                              ↑
                                          Collapsible, mặc định mở khi có session
```

**Chat Panel internals**:

```
ChatPanel
  ├── SessionHeader
  │     ├── Title (editable inline)
  │     ├── SessionMeta (turns, tokens, case gắn với)
  │     ├── ContextMeter (progress bar % token budget)
  │     └── Actions [Lịch sử | Fork | Xuất]
  ├── MessageList (virtualized scroll)
  │     └── MessageItem
  │           ├── RoleIndicator
  │           ├── Content (markdown render)
  │           ├── CitationChips (nếu là assistant)
  │           ├── Meta (model, latency, timestamp)
  │           ├── FeedbackBar (thumbs up/down)
  │           └── MessageActions [Fork từ đây | Thêm vào báo cáo]
  ├── SummarizedBanner (nếu có context_summary đang active)
  │     "X turns đầu đã được tóm tắt  [Xem toàn bộ]"
  └── InputArea
        ├── Textarea (auto-resize, Shift+Enter = newline)
        ├── SendButton
        └── QuickActions [Tạo báo cáo | Hỏi về finding hiện tại]
```

**ContextMeter**:

```
[Context: ████████░░  78%]   → màu xanh
[Context: █████████░  91%]   → màu vàng cam + tooltip "Sắp đầy context"
[Context: ██████████  100%]  → màu đỏ + banner cảnh báo
```

---

### 6.3. Report Panel — Mở rộng từ panel hiện có

**Status Bar** (trên cùng report panel):

```
┌─────────────────────────────────────────────────────────────────┐
│  [AI SINH]  →  [Đang soạn]  →  [Chờ duyệt]  →  [Đã duyệt]   │
│               ↑ đang ở đây                                     │
│  Lưu lúc 14:32 · v3 · Từ session "Case 001 infiltrate"        │
│  [So sánh versions ▾]  [Xem audit trail]  [Xuất PDF]          │
└─────────────────────────────────────────────────────────────────┘
```

**Version Selector**:

```
[AI draft] [v1] [v2] [v3 ←hiện tại] [v4]
                              ↑ click sang version khác → read-only view
```

**Diff View** (khi chọn so sánh):

```
┌── So sánh ──────────────────────────────────────────────────────┐
│  [AI Draft gốc]  ↔  [v3 hiện tại]  ▾ (dropdown chọn version)  │
│  ─────────────────────────────────────────────────────────────  │
│  Xanh lá = BS thêm · Đỏ = BS xóa · Vàng = sửa                 │
│                                                                  │
│  [inline diff text với highlight màu]                           │
└──────────────────────────────────────────────────────────────────┘
```

Diff algorithm: `diff-match-patch` library (đã có trong npm ecosystem, nhẹ, không cần server).

**Audit Trail Panel** (expandable section cuối báo cáo):

```
LỊCH SỬ THAY ĐỔI
─────────────────────────────────────────────
14:46  AI sinh bản nháp từ session "Case 001"     [llama3.2:70b · policy v2.1]
14:50  BS Minh chỉnh sửa  ·  v1 → v2             [3 đoạn thay đổi]
14:52  BS Minh gửi duyệt                           [Chờ duyệt]
15:10  BS Hoa trả về  ·  "Cần thêm so sánh cũ"   [Trả về]
15:15  BS Minh chỉnh sửa  ·  v2 → v3             [1 đoạn thêm]
15:16  BS Minh gửi duyệt lại                       [Chờ duyệt]
15:18  BS Hoa duyệt                                [Đã duyệt]
```

**Concurrent Edit Lock Banner**:

```
┌─────────────────────────────────────────────────────────┐
│  BS Hoa đang xem và chỉnh sửa báo cáo này               │
│  Bạn đang ở chế độ xem — thay đổi sẽ không được lưu    │
│  [Thông báo cho BS Hoa]  [Kiểm tra lại sau 1 phút]      │
└──────────────────────────────────────────────────────────┘
```

**Watermark Export**:

| Trạng thái | Watermark |
|---|---|
| `draft` | "PHIEN BAN NHAP — CHUA DUOC DUYET · KHONG DUNG CHO LAM SANG" (chữ mờ xéo) |
| `under_review` | "DANG CHO DUYET · CHUA CO GIA TRI PHAP LY" |
| `approved` | "DA DUYET · BS [Tên] · [Ngày giờ]" + QR code |
| `superseded` | "DA THAY THE · Xem phien ban [ID] moi hon" |

---

### 6.4. Dashboard — Tab "Báo cáo" và "Chờ duyệt"

```
Dashboard
  ├── Tab: Ca bệnh (existing)
  ├── Tab: Báo cáo  ← MỚI
  │     ├── Filter: Tất cả / Của tôi / Chờ duyệt / Đã duyệt
  │     └── ReportTable
  │           columns: Ca bệnh · Loại · Trạng thái · Phiên bản · BS viết · Ngày gửi · Actions
  └── Tab: Chờ duyệt (cho reviewer)  ← MỚI
        └── ReviewQueue
              ├── BatchApprove (checkbox select)
              └── ReviewItem
                    ├── Thumbnail (X-ray nhỏ)
                    ├── ReportMeta
                    ├── CitationCount
                    └── QuickActions [Xem | Duyệt | Trả về]
```

---

## 7. Chuẩn y tế và compliance

### 7.1. Checklist bắt buộc per MED principles (từ PRD)

| MED | Yêu cầu | Triển khai |
|---|---|---|
| MED-01 | Intended use visible | Badge "AI SINH" không thể ẩn trên mọi content AI, warning khi export draft |
| MED-02 | Human review by default | `approved` state chỉ được set bởi user có role `reviewer` trở lên; UI không cho export clinical khi chưa approved |
| MED-03 | Provenance visible | Mỗi report version lưu `model_id` + `policy_version` + `citation_snapshot`; hiện trong UI |
| MED-04 | Fail closed | Khi `citation_snapshot` chứa document đã bị xóa → RV-10 alert; không cho approve nếu thiếu citations |
| MED-05 | Least surprise | Confidence meter chỉ tính từ similarity score thực, không inflate; label rõ "Độ tương đồng RAG" không phải "Độ chính xác" |
| MED-06 | Separation AI / approved | Status bar phân biệt rõ bằng màu: xám = AI draft, cam = chờ duyệt, xanh = đã duyệt |
| MED-07 | Role-based | RLS trên Supabase + RBAC middleware; reviewer không thấy session của người khác trừ khi cùng episode |
| MED-08 | Auditability | Mọi action có nghĩa lâm sàng log vào `audit_logs` + surface qua Audit Trail UI |

### 7.2. Dữ liệu không được lưu trong session

- Thông tin định danh bệnh nhân đầy đủ (tên, CMND, địa chỉ) — chỉ `episode_id` + `patient_ref` mã hóa
- Nội dung hình ảnh DICOM raw
- Token API key, credentials

### 7.3. Retention policy

| Bảng | Retention | Xóa cứng? |
|---|---|---|
| `chat_sessions` (active) | Vô thời hạn | Chỉ archive |
| `chat_sessions` (archived) | 2 năm sau archive | Soft delete sau 2 năm |
| `chat_messages` | Theo session | Cascade khi session bị xóa cứng |
| `report_versions` | Vô thời hạn | Không bao giờ xóa (immutable) |
| `draft_reports` (superseded) | 7 năm | Theo quy định hồ sơ y tế |
| `audit_logs` | 7 năm | Không xóa |

---

## 8. Kế hoạch sprint

### Sprint A — Nền tảng (tuần 1-2)

**Mục tiêu**: Backend + DB hoạt động, không có UI mới. Không break existing.

**Backend tasks**:
- [ ] A1. Viết migration SQL tạo `chat_sessions`, `chat_messages`, `report_versions`, `report_locks`
- [ ] A2. Thêm cột `session_id`, `current_version`, `superseded_by` vào `draft_reports`
- [ ] A3. Cập nhật `Database` interface trong `apps/api/src/lib/supabase/client.ts`
- [ ] A4. Tạo `apps/api/src/routes/sessions.ts` — CRUD sessions + messages
- [ ] A5. Tạo `apps/api/src/routes/reports.ts` — version CRUD, diff, lock
- [ ] A6. Tạo `apps/api/src/lib/sessions/context-builder.ts` — sliding window logic
- [ ] A7. Tạo `apps/api/src/lib/sessions/auto-title.ts` — LLM title generation
- [ ] A8. Đăng ký routes mới trong `apps/api/src/index.ts`

**Validation**:
- [ ] A9. Viết test cơ bản cho session CRUD (file `_tests/sessions.test.ts`)
- [ ] A10. TypeScript check: `cd apps/api && npx tsc --noEmit`

**Acceptance criteria Sprint A**:
- `POST /api/sessions` tạo được session, liên kết được `episode_id`
- `POST /api/sessions/:id/messages` stream được response từ CAE agent và lưu cả hai messages
- `PATCH /api/reports/:draftId` tạo được `report_version` mới
- Không có existing API nào bị break

---

### Sprint B — Core UX (tuần 3-4)

**Mục tiêu**: Session sidebar + chat persistence + auto-save report hoạt động end-to-end.

**Frontend tasks**:
- [ ] B1. Tạo `apps/web/src/lib/api/sessions.ts` — client methods cho session API
- [ ] B2. Tạo `apps/web/src/hooks/useChatSession.ts` — manage session state, streaming, persistence
- [ ] B3. Tạo `apps/web/src/components/chat/ChatSessionSidebar.tsx`
- [ ] B4. Tạo `apps/web/src/components/chat/ChatPanel.tsx` (tích hợp vào Case Detail)
- [ ] B5. Tạo `apps/web/src/components/chat/MessageItem.tsx` + CitationChips, FeedbackBar
- [ ] B6. Tạo `apps/web/src/components/chat/ContextMeter.tsx`
- [ ] B7. Cập nhật Case Detail layout — thêm ChatPanel, điều chỉnh flex layout
- [ ] B8. Implement auto-save report (debounce 30s) + SaveIndicator
- [ ] B9. Tạo `apps/web/src/components/report/ReportVersionBar.tsx`

**Acceptance criteria Sprint B**:
- Refresh trình duyệt xong, chat history vẫn còn và load lại đúng
- Session tự đặt tên sau turn đầu
- Report auto-save hiển thị "Đã lưu lúc HH:MM"
- Context meter hiện đúng %
- TypeScript check: `cd apps/web && npx tsc --noEmit`

---

### Sprint C — Review workflow + Diff (tuần 5-6)

**Mục tiêu**: Approval flow đầy đủ, diff view, audit trail UI, export PDF.

- [ ] C1. Implement diff endpoint `GET /api/reports/:draftId/diff`
- [ ] C2. Tạo `apps/web/src/components/report/DiffViewer.tsx` dùng `diff-match-patch`
- [ ] C3. Tạo `apps/web/src/components/report/AuditTrailPanel.tsx`
- [ ] C4. Implement concurrent edit lock (polling 30s)
- [ ] C5. Tạo `apps/web/src/components/report/ConcurrentEditBanner.tsx`
- [ ] C6. Implement `POST /api/reports/:draftId/approve` + reject với role check
- [ ] C7. Implement approval workflow UI — submit button, review queue tab
- [ ] C8. Export PDF với watermark (dùng `@react-pdf/renderer` hoặc Puppeteer server-side)
- [ ] C9. QR code trong PDF → link `GET /api/reports/:draftId/verify` (public, no auth)

**Acceptance criteria Sprint C**:
- BS reviewer có thể approve/reject từ review queue
- Diff view hiện đúng thay đổi giữa AI draft và version hiện tại
- Export PDF draft có watermark, export approved không có watermark mà có chữ ký số
- Concurrent edit: người thứ 2 vào thấy banner read-only

---

### Sprint D — Advanced (tuần 7-8)

- [ ] D1. Fork session — UI + API
- [ ] D2. Export session thành PDF / Markdown
- [ ] D3. Full-text search sessions (`tsvector` GIN index đã có)
- [ ] D4. Supersede report flow
- [ ] D5. Dead citation alert (RV-10) — cron job check `citation_snapshot` vs documents hiện tại
- [ ] D6. Dashboard tab "Báo cáo" + "Chờ duyệt"
- [ ] D7. Retention policy — cron job mark archive / soft delete
- [ ] D8. Performance: lazy-load messages (chỉ load 20 messages gần nhất, load thêm khi scroll lên)

---

## 9. File structure mới

```
apps/api/src/
  routes/
    sessions.ts          ← MỚI
    reports.ts           ← MỚI (không đụng routes/cae.ts)
  lib/
    sessions/
      context-builder.ts ← MỚI — sliding window + token counting
      auto-title.ts      ← MỚI — LLM title generation
    reports/
      versioning.ts      ← MỚI — create/get versions, diff logic
      lock.ts            ← MỚI — concurrent edit lock
      export.ts          ← MỚI — PDF generation
  supabase-migrations/
    005_chat_sessions.sql       ← MỚI
    006_report_versions.sql     ← MỚI

apps/web/src/
  lib/api/
    sessions.ts          ← MỚI
    reports-v2.ts        ← MỚI (không đụng lib/api/client.ts cũ)
  hooks/
    useChatSession.ts    ← MỚI
    useReportVersions.ts ← MỚI
    useReportLock.ts     ← MỚI
  components/
    chat/
      ChatSessionSidebar.tsx  ← MỚI
      ChatPanel.tsx           ← MỚI
      MessageItem.tsx         ← MỚI
      ContextMeter.tsx        ← MỚI
      SummarizedBanner.tsx    ← MỚI
    report/
      ReportVersionBar.tsx    ← MỚI
      DiffViewer.tsx          ← MỚI
      AuditTrailPanel.tsx     ← MỚI
      ConcurrentEditBanner.tsx ← MỚI
      ExportButton.tsx        ← MỚI
```

---

## 10. Dependencies cần thêm

| Package | Dùng cho | Sprint |
|---|---|---|
| `diff-match-patch` | Diff text giữa 2 versions (frontend) | C |
| `@react-pdf/renderer` | Export PDF client-side hoặc `puppeteer` server-side | C |
| `qrcode` | Tạo QR code cho audit trail URL | C |
| `tiktoken` | Token counting chính xác theo model | A |
| `p-debounce` | Debounce auto-save (hoặc dùng lodash đã có) | B |

---

## 11. Rủi ro và giảm thiểu

| Rủi ro | Xác suất | Ảnh hưởng | Giảm thiểu |
|---|---|---|---|
| Token counting không chính xác → context overflow | Trung bình | Cao | Dùng `tiktoken`, thêm buffer 15% |
| Concurrent session từ cùng user trên 2 tab → duplicate messages | Thấp | Trung bình | Unique constraint `(session_id, idx)` + server-side idx assignment |
| `report_versions` tăng nhanh do auto-save mỗi 30s | Cao | Thấp | Chỉ tạo version khi nội dung thực sự thay đổi (hash blocks trước khi upsert) |
| LLM auto-title thêm latency cho message đầu tiên | Cao | Thấp | Fire-and-forget, không chặn response stream |
| PDF export nặng nếu dùng Puppeteer | Trung bình | Trung bình | Thêm job queue, không block request thread |
| RLS Supabase sai → lộ session người khác | Thấp | Rất cao | Test RLS bằng user khác nhau trong `_tests/`, audit trước deploy |

---

## 12. Thứ tự ưu tiên tuyệt đối

Nếu resource hạn chế, implement theo thứ tự này:

1. **SH-01 + SH-02** (persistent session + auto-title) — pain point #1 của bác sĩ
2. **RV-01 + RV-02** (report versions + citation snapshot) — compliance bắt buộc
3. **RV-03** (auto-save) — tránh mất công sức người dùng
4. **SH-03** (session sidebar) — discoverability
5. **RV-05** (approval workflow) — đã có partial ở `draft_reports`, chỉ cần wire UI
6. Phần còn lại theo sprint plan

---

*Tài liệu này cần được review bởi: kỹ thuật backend, frontend, và ít nhất 1 người đại diện workflow lâm sàng trước khi bắt đầu Sprint A.*
