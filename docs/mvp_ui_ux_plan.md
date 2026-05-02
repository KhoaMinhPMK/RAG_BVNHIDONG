# Kế hoạch chi tiết triển khai MVP UI/UX — Hệ thống RAG Y tế Nhi khoa

## 0. Thông tin tài liệu

| Trường | Nội dung |
| --- | --- |
| Tên tài liệu | MVP UI/UX Implementation Plan |
| Phạm vi | Frontend MVP cho hệ thống RAG y tế hỗ trợ chẩn đoán viêm phổi Nhi khoa |
| Đối tượng | Frontend dev, UX/UI, BA, QA, Tech Lead, Product Owner |
| Tài liệu nguồn | `docs/yeu_cau_he_thong_rag.md`, `docs/prd_ui_flow_y_te_rag.md`, `docs/wireflow_screen_by_screen_ui_rag.md`, `note/de_cuong_nghien_cuu.md` |
| Trạng thái | Draft v1.0 — sẵn sàng cho Sprint 0 |
| Nguyên tắc tổng | UI-first, mock-driven, contract-first, fail-closed by default |

---

## 1. Mục tiêu của MVP UI

### 1.1. Mục tiêu sản phẩm
- Chứng minh được luồng nghiệp vụ trung tâm: **Episode → Template → Draft → Review → Approve** với đầy đủ provenance, citation và audit trail.
- Cung cấp giao diện **Knowledge Query có citation drawer** để bác sỹ tra cứu guideline an toàn.
- Hiện thực 8 nguyên tắc y tế MED-01..08 ngay từ MVP, không dồn sang phase sau.
- Tách biệt rõ **AI-generated** và **approved content** ở mức UI để phòng overtrust.

### 1.2. Mục tiêu kỹ thuật
- Frontend hoạt động **độc lập** với backend thật trong Sprint 0–3 nhờ mock layer (MSW).
- Mọi call ra ngoài đều qua **một API client duy nhất** với typed contract → swap backend chỉ cần đổi base URL và bật/tắt MSW.
- Cấu trúc thư mục **scale-ready**: dễ tách monorepo, dễ thêm module, dễ chuyển micro-frontend.
- **Type-safe end-to-end** với TypeScript strict + Zod runtime validation.

### 1.3. Mục tiêu UX (KPI từ PRD)
- Time to first evidence ≤ 10 giây.
- Provenance coverage 100% với mọi field trọng yếu.
- Người duyệt phân biệt được field AI/Manual/Locked **trong 1 cái nhìn**.
- Mọi từ chối/warning đều có lý do và đường dẫn xử lý tiếp.

---

## 2. Phạm vi MVP

### 2.1. Trong phạm vi
- 7 màn hình MVP: **S00, S01, S02, S03, S04, S05, S06**.
- Component system: AnswerCard, CitationDrawer, ProvenanceChip, FieldBadge, WarningBanner, ApprovalModal, PatientContextBar.
- RBAC client-side cho 4 vai trò: `clinician`, `radiologist`, `researcher`, `admin`.
- Mock layer cho toàn bộ API contract đã định nghĩa.
- Audit log read-only rút gọn ở cấp draft.
- Empty/Loading/Error/Blocked state cho mọi màn hình MVP.
- E2E cho happy path + safety path theo wireflow.

### 2.2. Ngoài phạm vi MVP (để Phase 2)
- S07 Compare Models (chỉ stub).
- S08, S09 Knowledge Base Management đầy đủ (chỉ list read-only).
- S10, S11 Audit Console & Incident Drawer đầy đủ.
- Word/PDF export.
- Tích hợp HL7/FHIR.
- Đa ngôn ngữ thật (chỉ scaffold i18n).
- Mobile responsive nâng cao (chỉ desktop ≥ 1366 px).

---

## 3. Tech stack

| Lớp | Lựa chọn | Lý do |
| --- | --- | --- |
| Framework | **Next.js 14 (App Router)** | SSR optional, file-based routing, dễ deploy on-prem |
| Language | **TypeScript 5.x strict** | Type-safe contract, giảm null/undefined bug |
| Styling | **TailwindCSS 3.x + shadcn/ui** | Design token nhanh, primitive sao chép được vào repo |
| Icon | **Lucide React** | Open source, tree-shakeable |
| Form | **React Hook Form + Zod** | Validation runtime, schema reuse với API contract |
| State client | **Zustand** | Nhỏ gọn, không boilerplate |
| State server | **TanStack Query v5** | Cache, retry, optimistic update |
| API mocking | **MSW** | Mock đúng tầng network → swap backend dễ |
| RBAC | **Next middleware + custom hook** | Chặn route ở edge, không leak component |
| Charts | **Recharts** | Đủ cho dashboard MVP |
| Markdown | **react-markdown + rehype-sanitize** | Render answer an toàn |
| Utility | **clsx, tailwind-merge, date-fns, zod** | Standard |
| Test unit | **Vitest + React Testing Library** | Nhanh, tương thích Next |
| Test E2E | **Playwright** | Đa browser, recorder |
| Lint | **ESLint + Prettier + Husky + lint-staged + commitlint** | Bắt buộc trước commit |
| Storybook | **Storybook 8** | Tài liệu component, design QA |
| Env | **t3-env** | Validate env var lúc build |

### Cấm dùng ở MVP
- Redux Toolkit (TanStack Query + Zustand đã đủ).
- CSS-in-JS runtime.
- Component library closed-source kéo theo theme cứng.
- Render chain-of-thought ra UI (theo RAG-UI-04).

---

## 4. Cấu trúc thư mục chuyên nghiệp (scale-ready)

### 4.1. Cây thư mục

```
bvnhidong/
├── .github/workflows/        # ci.yml, e2e.yml
├── .husky/                   # pre-commit, commit-msg
├── docs/                     # Đã có
├── note/                     # Đã có
├── apps/
│   └── web/
│       ├── public/
│       ├── src/
│       │   ├── app/                # Next App Router (route thin)
│       │   │   ├── (auth)/login/page.tsx          # S00
│       │   │   ├── (app)/
│       │   │   │   ├── layout.tsx
│       │   │   │   ├── page.tsx                   # S01
│       │   │   │   ├── query/page.tsx             # S02
│       │   │   │   ├── episode/[id]/page.tsx      # S03
│       │   │   │   ├── draft/[id]/page.tsx        # S05
│       │   │   │   ├── compare/page.tsx           # S07 stub
│       │   │   │   ├── knowledge/page.tsx         # S08 stub
│       │   │   │   └── audit/page.tsx             # S10 stub
│       │   │   ├── api/                           # Next route handlers (proxy)
│       │   │   ├── error.tsx
│       │   │   ├── not-found.tsx
│       │   │   └── layout.tsx
│       │   ├── features/           # Feature-first
│       │   │   ├── auth/
│       │   │   ├── worklist/
│       │   │   ├── knowledge-query/
│       │   │   ├── episode/
│       │   │   ├── draft-report/
│       │   │   ├── template-selection/
│       │   │   ├── compare-models/                # stub
│       │   │   ├── knowledge-base/                # stub
│       │   │   └── audit/                         # stub
│       │   │   # Mỗi feature: components/, hooks/, api.ts, schema.ts, types.ts, index.ts
│       │   ├── components/
│       │   │   ├── ui/             # shadcn primitives
│       │   │   ├── medical/        # PatientContextBar, ProvenanceChip, WarningBanner...
│       │   │   ├── layout/         # AppShell, Sidebar, GlobalHeader, Breadcrumb
│       │   │   └── shared/         # EmptyState, ErrorState, LoadingSkeleton, PermissionDenied
│       │   ├── lib/
│       │   │   ├── api/            # client.ts, endpoints.ts, error.ts, types.ts
│       │   │   ├── mocks/          # browser.ts, server.ts, handlers/, fixtures/
│       │   │   ├── policy/         # rbac.ts, intended-use.ts, fail-closed.ts
│       │   │   ├── hooks/          # useAuth, useRole, useTelemetry, useUnsavedChanges
│       │   │   ├── utils/          # format, redact, diff, cn
│       │   │   └── constants/      # roles, statuses, routes, microcopy
│       │   ├── stores/             # Zustand: auth, draft, notification, ui
│       │   ├── styles/             # globals.css, tokens.css
│       │   ├── types/              # domain.ts, api.ts
│       │   ├── config/             # env.ts, feature-flags.ts, site.ts
│       │   └── i18n/
│       ├── tests/
│       │   ├── unit/
│       │   ├── integration/
│       │   ├── e2e/
│       │   └── setup/
│       ├── .storybook/
│       ├── next.config.mjs
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       └── package.json
├── packages/                 # Sẵn cho monorepo về sau
├── .editorconfig
├── .eslintrc.cjs
├── .prettierrc
├── package.json              # workspaces
├── pnpm-workspace.yaml
└── README.md
```

### 4.2. Quy tắc đặt file đúng tầng

| Loại | Đặt ở | Lưu ý |
| --- | --- | --- |
| Route page | `app/**/page.tsx` | Chỉ orchestrate, **không** logic nghiệp vụ |
| Logic feature | `features/<name>/` | Tự đóng gói, expose qua `index.ts` |
| Component cross-feature | `components/medical/` hoặc `components/shared/` | Không phụ thuộc feature |
| API call | `features/<name>/api.ts` | Bắt buộc dùng `apiClient` |
| Mock | `lib/mocks/handlers/` | Mỗi domain 1 file |
| Type domain | `types/domain.ts` | Khớp `schema.ts` qua `z.infer` |
| Hằng số | `lib/constants/` | Không hard-code rải rác |

### 4.3. Quy tắc import boundary
- `app/` import được `features/`, `components/`, `lib/`, `stores/`, `types/`.
- `features/` **không** import lẫn nhau → đẩy phần dùng chung lên `components/` hoặc `lib/`.
- `components/ui/` (shadcn) **không** import `features/`.
- `components/medical/` import được `components/ui/` nhưng **không** import `features/`.
- ESLint rule `import/no-restricted-paths` enforce.

---

## 5. Quy tắc code (bắt buộc)

### 5.1. TypeScript
- `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`.
- Cấm `any` (dùng `unknown` rồi narrow).
- Cấm `as` ép kiểu trừ khi có comment lý do.
- Mọi prop có interface/type rõ ràng.
- Mọi response API qua `zod.parse()` ở ranh giới network.

### 5.2. Naming convention

| Thực thể | Quy ước | Ví dụ |
| --- | --- | --- |
| Component file | PascalCase | `AnswerCard.tsx` |
| Hook file | camelCase prefix `use` | `useDraftReport.ts` |
| Util file | kebab-case | `format-date.ts` |
| Folder | kebab-case | `draft-report/` |
| Type/Interface | PascalCase, không prefix `I` | `DraftReport` |
| Constant | UPPER_SNAKE_CASE | `DRAFT_STATUS.UNDER_REVIEW` |
| Enum-like | `as const` | `export const X = {...} as const` |
| Boolean prop | `is/has/can/should` | `isLoading`, `hasWarning` |
| Event handler | `on<Event>` props, `handle<Event>` local | `onApprove`, `handleApproveClick` |

### 5.3. Component
- 1 file = 1 component default export (trừ helper scoped).
- Tách logic ra hook nếu component > 200 dòng.
- Có **3 trạng thái tối thiểu**: loading, empty, error.
- **Cấm** truyền PHI qua URL query.
- **Cấm** render bất kỳ AI content nào không có badge `AI`.

### 5.4. Style
- Tailwind utility-first, **không** viết CSS riêng trừ khi token system yêu cầu.
- Dùng `cn()` (clsx + tailwind-merge).
- Mọi spacing/color phải dùng design token.
- Status/warning/danger **bắt buộc** kèm icon + label, không chỉ phụ thuộc màu.

### 5.5. Form
- Bắt buộc React Hook Form + Zod resolver.
- Schema Zod đặt cùng feature, **dùng chung** với mock handler.
- Field AI sinh có thuộc tính `dataSource: 'ai' | 'auto' | 'manual' | 'locked'` để render badge tự động.
- Field không pass schema → render `WarningBanner` ngay dưới và disable submit nếu là field trọng yếu.

### 5.6. API & data fetching
- **Không** gọi `fetch` trực tiếp trong component → qua `apiClient` hoặc TanStack Query hook.
- Mỗi endpoint: TS type, Zod schema, MSW mock handler, ít nhất 1 unit test.
- Mọi mutation thay đổi trạng thái nghiệp vụ phải sinh **audit event payload** ở client.
- Mọi 4xx/5xx map qua `ApiError` có `code`, `userMessage`, `incidentId?`.

### 5.7. Logging & telemetry
- Dùng hook `useTelemetry()` để emit event analytics theo bảng Section 9 wireflow.
- Không log PHI ra console. Có util `redact()` bắt buộc dùng khi debug.
- Production: đẩy log lên `/telemetry`.

### 5.8. Git & PR
- Branch: `feat/`, `fix/`, `chore/`, `docs/`, `test/`.
- Conventional Commits: `feat(draft): add field badge component`.
- PR phải có: mô tả what+why, link task ID, screenshot/Storybook nếu UI, checklist self-review (a11y, error state, telemetry).
- CI bắt buộc pass: `lint + typecheck + unit test + build`.

---

## 6. Quy tắc thiết kế UI

### 6.1. Design tokens

```css
/* styles/tokens.css */
:root {
  --color-bg-base: #ffffff;
  --color-bg-subtle: #f7f8fa;
  --color-bg-muted: #eef0f3;
  --color-text-primary: #0f172a;
  --color-text-secondary: #475569;
  --color-border: #e2e8f0;

  --color-info: #2563eb;       /* citation, provenance */
  --color-warning: #b45309;    /* uncertainty, missing evidence */
  --color-danger: #b91c1c;     /* policy block, scope violation */
  --color-success: #15803d;    /* approved, synced */
  --color-ai-accent: #7c3aed;  /* AI content */

  --radius-sm: 4px; --radius-md: 8px; --radius-lg: 12px;
  --space-1: 4px; --space-2: 8px; --space-3: 12px;
  --space-4: 16px; --space-6: 24px; --space-8: 32px;

  --font-sans: 'Inter', 'Be Vietnam Pro', system-ui, sans-serif;
  --text-xs: 12px; --text-sm: 14px; --text-base: 16px;
  --text-lg: 18px; --text-xl: 20px; --text-2xl: 24px;

  --leading-tight: 1.25; --leading-normal: 1.5; --leading-relaxed: 1.625;
  --shadow-sm: 0 1px 2px rgba(15,23,42,.06);
  --shadow-md: 0 4px 8px rgba(15,23,42,.08);

  --z-base: 0; --z-sticky: 10; --z-drawer: 30; --z-modal: 40; --z-toast: 50;
}
```

### 6.2. Status chip palette

| Status | Nền | Chữ | Icon |
| --- | --- | --- | --- |
| `draft` | muted | text-secondary | `FileText` |
| `under_review` | info 10% | info | `Eye` |
| `approved` | success 10% | success | `CheckCircle2` |
| `rejected` | danger 10% | danger | `XCircle` |
| `archived` | muted | text-secondary | `Archive` |
| `needs_evidence` | warning 15% | warning | `AlertTriangle` |
| `policy_blocked` | danger 15% | danger | `ShieldX` |
| `low_confidence` | warning 10% | warning | `AlertCircle` |
| `outdated_source` | warning 10% | warning | `Clock` |

### 6.3. Field badge palette (Draft Review)

| Badge | Ý nghĩa | Style |
| --- | --- | --- |
| `AI` | Model sinh, chưa người sửa | viền tím ai-accent, icon `Sparkles` |
| `Auto` | Auto-fill từ HIS/EMR/PACS | viền info, icon `Database` |
| `Manual` | Người dùng nhập/sửa | viền neutral, icon `PenLine` |
| `Locked` | Khoá theo policy | nền muted, icon `Lock`, không cursor |
| `Needs review` | Có warning chờ review | viền warning, icon `Eye` |
| `Evidence missing` | Thiếu citation | viền danger nét đứt, icon `FileWarning` |

### 6.4. Layout & spacing
- **Grid 12 cột**, gap `var(--space-4)`.
- Container max-width 1440 px MVP, padding ngang `var(--space-6)`.
- Patient context bar **sticky top**, height 56 px.
- Drawer mở từ phải: width 480 px (citation), 560 px (provenance).
- Modal width 560 px (default), 720 px (approval).

### 6.5. Animation
- Transition tối đa 200 ms.
- Không animation phức tạp ở S05/S06.
- Skeleton loading thay spinner nếu > 500 ms.

### 6.6. Microcopy bắt buộc

Đặt tập trung tại `lib/constants/microcopy.ts`:

```ts
export const MICROCOPY = {
  draftBanner: 'Day la nhap do he thong ho tro sinh. Can nguoi duoc phan quyen ra soat truoc khi su dung.',
  insufficientEvidence: 'Khong du bang chung noi bo de tra loi an toan cho yeu cau nay.',
  outOfScope: 'Yeu cau nay vuot pham vi su dung da phe duyet cua he thong.',
  citationFlagged: 'Mot hoac nhieu trich dan can duoc kiem tra lai truoc khi tiep tuc.',
  compareModeWarning: 'Che do nay chi dung cho nghien cuu va khong phuc vu phat hanh noi dung lam sang.',
} as const
```

**Cấm** hard-code chuỗi dài trong component.

---

## 7. Roadmap & Sprint plan

### 7.1. 6 sprint (12 tuần)

| Sprint | Tuần | Mục tiêu | Output |
| --- | --- | --- | --- |
| Sprint 0 | 1–2 | Foundation: repo, CI, design tokens, mock layer, RBAC, AppShell | App chạy, CI xanh, Storybook online |
| Sprint 1 | 3–4 | S00 Login + S01 Dashboard + medical primitives | Login mock, dashboard widget |
| Sprint 2 | 5–6 | S02 Knowledge Query + Citation drawer | Query → answer + citation, refuse safely |
| Sprint 3 | 7–8 | S03 Episode + S04 Template Selection | Mở episode, tạo draft từ template |
| Sprint 4 | 9–10 | S05 Draft Review + S06 Approval | Full review/approve happy path |
| Sprint 5 | 11–12 | Hardening: a11y, perf, telemetry, E2E | UAT-ready build |

### 7.2. Sprint Done definition
- Toàn bộ task đạt DoD (Section 15).
- E2E journey thuộc sprint pass CI.
- Demo nội bộ + biên bản feedback.

---

## 8. Backlog chi tiết theo task

> Quy ước: `[Sx-Tn]` = Sprint x, Task n. Mỗi task có **AC** (acceptance criteria), **Test** (test case ID ở Section 12).

### 8.1. Sprint 0 — Foundation

#### [S0-T01] Khởi tạo repo và toolchain
- Tạo Next.js 14 app trong `apps/web`.
- TypeScript strict, ESLint (with `import/no-restricted-paths`), Prettier, Husky, lint-staged, commitlint.
- `tsconfig.json` paths: `@/components`, `@/features`, `@/lib`, `@/types`, `@/stores`.
- **AC**: `pnpm dev`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` đều chạy.
- **Test**: TC-INFRA-01.

#### [S0-T02] CI/CD GitHub Actions
- Workflow `ci.yml`: lint + typecheck + unit test + build.
- Workflow `e2e.yml`: Playwright khi PR vào `main`.
- Cache pnpm, Next build cache.
- **AC**: PR phải pass CI mới merge.
- **Test**: TC-INFRA-02.

#### [S0-T03] Design tokens + Tailwind config
- Implement `styles/tokens.css` (Section 6.1).
- Map vào `tailwind.config.ts` qua `theme.extend`.
- Storybook story "Design Tokens" hiển thị màu, typo, spacing.
- **AC**: Tất cả màu/spacing/typo dùng được qua class Tailwind, không magic value.
- **Test**: TC-DS-01.

#### [S0-T04] Cài shadcn/ui primitives
- Add: `Button`, `Input`, `Card`, `Dialog`, `Drawer`, `Tabs`, `Badge`, `Tooltip`, `Toast`, `Skeleton`, `Separator`, `ScrollArea`, `Form`.
- Mỗi component có Storybook story.
- **AC**: Storybook hiển thị đủ variant.
- **Test**: TC-DS-02.

#### [S0-T05] App Shell + routing skeleton
- `AppShell.tsx` với `GlobalHeader`, `Sidebar`, `Breadcrumb`, `<Outlet />`.
- 7 route stub có placeholder.
- Middleware kiểm tra session mock và redirect.
- **AC**: Click sidebar chuyển đúng route, breadcrumb update.
- **Test**: TC-NAV-01.

#### [S0-T06] RBAC client primitive
- `lib/policy/rbac.ts`: `can(role, action, resource?)`.
- Hook `useRole()` + component `<Guard role={...}>`.
- 4 role: `clinician`, `radiologist`, `researcher`, `admin`.
- Map ma trận quyền hạn theo Section 6.2 PRD vào `lib/policy/permissions.ts`.
- **AC**: Component bị block nếu role không đủ; có fallback UI.
- **Test**: TC-RBAC-01, TC-RBAC-02.

#### [S0-T07] Mock layer MSW
- Cài MSW, cấu hình `browser.ts` cho dev và `server.ts` cho test.
- Skeleton handler cho mỗi domain (auth, episode, query, draft, template, citation, audit).
- Fixtures JSON: tối thiểu 3 episode, 5 document, 2 template.
- **AC**: `NEXT_PUBLIC_API_MOCKING=enabled` thì handler trả mock; tắt thì hit URL thật.
- **Test**: TC-MOCK-01.

#### [S0-T08] API client wrapper
- `lib/api/client.ts`: fetch wrapper với interceptor (auth header, error handling, telemetry).
- `lib/api/error.ts`: `ApiError` class.
- `lib/api/endpoints.ts`: tập trung URL.
- Hook `useApiQuery`, `useApiMutation` wrap TanStack Query.
- **AC**: Mọi feature đều dùng client này, không có `fetch` trực tiếp.
- **Test**: TC-API-01.

#### [S0-T09] Telemetry hook
- `useTelemetry()` emit event với schema `{event, screen, payload, ts, userId, role}`.
- Buffer rồi flush mỗi 5s hoặc on unload.
- **AC**: Event được gọi đúng theo Section 9 wireflow.
- **Test**: TC-TEL-01.

#### [S0-T10] Storybook + a11y addon
- Cài `@storybook/addon-a11y`, `@storybook/addon-interactions`.
- Mỗi primitive có a11y check.
- **AC**: 0 violation Critical.
- **Test**: TC-A11Y-01.

### 8.2. Sprint 1 — Login + Dashboard + Medical primitives

#### [S1-T01] `PatientContextBar`
- Props: `episodeId`, `age`, `gender`, `admittedAt`, `department`, `sensitivityLevel`, `dataStatus`.
- Sticky top, height 56 px, badge sensitivity, icon `AlertTriangle` nếu `dataStatus !== 'complete'`.
- **AC**: Render đúng các state; Storybook đủ variant.
- **Test**: TC-COMP-01.

#### [S1-T02] `ProvenanceChip`
- Props: `sourceType`, `documentName`, `version`, `effectiveStatus`, `confidence?`.
- Click mở popover hiển thị chi tiết.
- **AC**: Click hiện popover; có keyboard support.
- **Test**: TC-COMP-02.

#### [S1-T03] `WarningBanner` + `IntendedUseTag`
- 6 loại banner theo Section 14.4 PRD.
- `IntendedUseTag` luôn hiển thị ở đầu mọi màn hình clinical.
- **AC**: Đủ 6 loại, có icon + label, không chỉ phụ thuộc màu.
- **Test**: TC-COMP-03.

#### [S1-T04] `StatusChip` + `FieldBadge`
- Theo bảng Section 6.2 và 6.3.
- **AC**: Storybook đủ tất cả variant.
- **Test**: TC-COMP-04.

#### [S1-T05] Màn hình S00 Login
- Form email + password (mock), SSO button (stub).
- Sau login: load `userContext`, `featureFlags`, route theo role.
- Empty state khi auth service down.
- **AC**: 4 role login được ra dashboard mặc định khác nhau.
- **Test**: TC-S00-01..04.

#### [S1-T06] Màn hình S01 Dashboard
- 6 widget theo Section 5.2 wireflow: Tasks needing review, Drafts pending approval, Recent episodes, Flagged citations, Knowledge updates, System health.
- Filter theo role, khoa phòng, status, ngày.
- Empty state riêng cho từng widget; degrade không sập trang.
- **AC**: Click widget → đi đúng route preload context.
- **Test**: TC-S01-01..06.

#### [S1-T07] Quick search trong header
- Search episode/draft/document (mock).
- Group theo loại, tối đa 5 mỗi nhóm.
- **AC**: Phím tắt `Ctrl+K` mở search.
- **Test**: TC-S01-07.

#### [S1-T08] Notification + system alert
- Toast cho event hệ thống, banner đỏ cho policy/security alert.
- **AC**: Alert nghiêm trọng không tự dismiss.
- **Test**: TC-S01-08.

### 8.3. Sprint 2 — Knowledge Query + Citation drawer

#### [S2-T01] `QueryComposer`
- Free-text input, character limit 2000.
- Filter chip: type, department, age group, effective, language.
- Toggle "Chỉ tài liệu đang hiệu lực".
- Patient context chip nếu vào từ S03.
- **AC**: Submit gọi API `/query`, validate Zod ở client.
- **Test**: TC-S02-01..03.

#### [S2-T02] `AnswerCard`
- Hiển thị: title, content (markdown sanitize), `IntendedUseTag`, `ModelVersionLabel`, timestamp, `WarningBanner` nếu có, citations, feedback bar.
- Section heading nếu answer dài.
- **AC**: Markdown render an toàn, không exec script.
- **Test**: TC-S02-04, TC-SEC-01.

#### [S2-T03] `CitationList` + `CitationDrawer`
- List citation: ordinal, document name, version, owner, effective date.
- Click → mở drawer phải, highlight đoạn.
- Drawer có nút "Open full document" (RBAC).
- **AC**: Mở drawer ≤ 2 thao tác từ answer; Esc đóng, focus trở về.
- **Test**: TC-S02-05, TC-A11Y-02.

#### [S2-T04] State machine query session
- States: `idle | searching | answered | refused | failed`.
- Refused: render box với lý do + microcopy chuẩn.
- Failed: hiện incident id + retry.
- **AC**: Branching đúng; state lưu Zustand.
- **Test**: TC-S02-06..09.

#### [S2-T05] Feedback bar
- 4 action: useful, not useful, wrong citation, needs update.
- Mở mini modal thu lý do nếu negative.
- **AC**: Submit ghi audit event `citation_flagged`.
- **Test**: TC-S02-10.

#### [S2-T06] Telemetry events S02
- `query_submitted`, `answer_rendered`, `citation_opened`, `citation_flagged`.
- **AC**: Event hiện trên dev console khi `NEXT_PUBLIC_TELEMETRY_DEBUG`.
- **Test**: TC-TEL-02.

### 8.4. Sprint 3 — Episode Workspace + Template Selection

#### [S3-T01] Episode summary card
- Patient demographics, history, imaging count, lab count.
- **AC**: Render từ mock fixture.
- **Test**: TC-S03-01.

#### [S3-T02] Prediction card + Uncertainty card
- `UncertaintyMeter` thanh ngang với label rõ.
- Disclaimer "Đây là kết quả hỗ trợ, không phải kết luận cuối cùng".
- **AC**: Uncertainty cao → tự động gắn `WarningBanner`.
- **Test**: TC-S03-02..03.

#### [S3-T03] Explanation panel
- Trigger button "Tao giai thich" disable nếu thiếu explainability payload (kèm tooltip).
- Pass policy → render 3 phần: Tom tat, Bang chung, Caveat. **Bắt buộc** tách block.
- **AC**: Không hiển thị reasoning thô; có banner "Hỗ trợ tham khảo".
- **Test**: TC-S03-04..05.

#### [S3-T04] Recent drafts list + activity log
- Show drafts liên quan, status badge, click mở S05.
- **AC**: Draft đang bị người khác sửa → mở read-only mode.
- **Test**: TC-S03-06.

#### [S3-T05] Modal S04 Template Selection
- 2 cột: list template active trái, preview schema phải.
- Hiện required/optional/locked field count, last approved version, intended use.
- **AC**: Template inactive không chọn được; pass thì tạo draft mới và navigate S05.
- **Test**: TC-S04-01..04.

#### [S3-T06] State guard
- `<UnsavedChangesGuard>` ở Episode khi đã trigger explanation và muốn rời.
- **AC**: Modal 3 lựa chọn (Lưu/Bỏ/Quay lại).
- **Test**: TC-S03-07.

### 8.5. Sprint 4 — Draft Review + Approval

#### [S4-T01] Layout S05
- 5 zone theo Section 5.6 wireflow.
- Section navigator filter: `All | Changed | Warnings | Required | Missing evidence`.
- **AC**: Filter hoạt động, count tự cập nhật.
- **Test**: TC-S05-01..02.

#### [S4-T02] `FormEditor` + `FieldRow`
- Render theo schema từ template; mỗi field có badge + provenance chip + warning inline.
- Field locked → readonly + icon.
- Field editable → edit thì badge tự đổi sang `Manual`.
- **AC**: Edit không làm mất citation gốc; có log "edit history" theo field.
- **Test**: TC-S05-03..05.

#### [S4-T03] `ProvenanceDrawer` theo field focus
- Click field → drawer phải hiện citation liên quan.
- Phím tắt: `P` mở drawer.
- **AC**: Citation mở được tài liệu gốc khi RBAC cho phép.
- **Test**: TC-S05-06.

#### [S4-T04] Diff toggle
- 3 mode: `Current | Original AI draft | Last approved version`.
- Highlight thêm/sửa/xoá theo màu (kèm icon).
- **AC**: Chuyển mode không mất scroll position; có filter "chỉ field đã đổi".
- **Test**: TC-S05-07..08.

#### [S4-T05] State machine draft
- `draft → under_review → edited → approved/rejected → archived`.
- Implement bằng Zustand + reducer.
- Chặn approve khi còn blocker warning.
- **AC**: Transition không hợp lệ throw error có code rõ ràng.
- **Test**: TC-S05-09..11.

#### [S4-T06] Modal S06 Approve
- Top summary, middle checklist (2 checkbox bắt buộc), bottom actions.
- Disable confirm khi còn blocker.
- **AC**: Submit gọi API + audit event; success quay lại S05 với status mới.
- **Test**: TC-S06-01..03.

#### [S4-T07] Modal S06 Reject/Return
- Lý do bắt buộc, category dropdown 6 giá trị, optional note.
- **AC**: Submit fail giữ nguyên data + hiện incident id.
- **Test**: TC-S06-04..06.

#### [S4-T08] Concurrent edit handling
- WebSocket mock hoặc polling 10s để check version.
- Hiện banner xung đột + reload diff.
- **AC**: Không cho save khi version stale.
- **Test**: TC-S05-12.

### 8.6. Sprint 5 — Hardening

#### [S5-T01] A11y audit toàn bộ
- Chạy axe-core trên mọi screen.
- Sửa toàn bộ violation Serious/Critical.
- **AC**: Lighthouse a11y ≥ 95.
- **Test**: TC-A11Y-03.

#### [S5-T02] Keyboard navigation
- Tab order, focus ring, shortcut (Ctrl+K, P, J/K).
- **AC**: Hoàn thành flow approve không cần chuột.
- **Test**: TC-A11Y-04.

#### [S5-T03] Performance budget
- Lighthouse perf ≥ 90 ở dashboard và S05.
- LCP < 2.5s ở mạng nội bộ giả lập.
- **AC**: CI block nếu bundle vượt budget.
- **Test**: TC-PERF-01.

#### [S5-T04] Error boundary + fallback
- `error.tsx` Next, `ErrorBoundary` cho từng feature.
- Tích hợp incident id mock.
- **AC**: Crash 1 widget không sập màn hình.
- **Test**: TC-ERR-01.

#### [S5-T05] E2E full journey
- Journey A, B, C theo Section 7 wireflow.
- Safety scenarios theo Section 10.2 wireflow.
- **AC**: Toàn bộ E2E pass trên CI.
- **Test**: Tất cả TC-E2E.

#### [S5-T06] Telemetry coverage
- Verify đủ 22 event theo Section 9 wireflow.
- **AC**: Bảng coverage 100%.
- **Test**: TC-TEL-03.

#### [S5-T07] Demo dress rehearsal + UAT
- Demo với 3 nhóm user thật.
- Thu feedback, mở ticket sửa.
- **AC**: Có biên bản feedback ký xác nhận.

---

## 9. Hợp đồng API mock (để swap backend sau)

### 9.1. Nguyên tắc
- Mỗi endpoint định nghĩa **1 lần** với Zod schema; reuse cho mock handler MSW, validation client trước render, test fixture.
- Khi backend thật về, **không cần đổi component**; chỉ:
  - Tắt MSW (`NEXT_PUBLIC_API_MOCKING=disabled`).
  - Cập nhật `endpoints.ts` nếu URL đổi.
  - Adapter (nếu cần) để map shape backend → shape mock đã chuẩn hoá.
- **Bắt buộc**: backend implement schema này hoặc qua adapter — không sửa frontend tuỳ tiện.

### 9.2. Danh sách endpoint MVP

| Method | Path | Mục đích | Schema |
| --- | --- | --- | --- |
| POST | `/auth/login` | SSO/local login | `LoginRequest`, `UserContext` |
| GET | `/me` | User context, role, feature flags | `UserContext` |
| GET | `/dashboard/widgets` | Worklist + counts | `DashboardPayload` |
| POST | `/query` | RAG query | `QueryRequest`, `AnswerPayload` |
| GET | `/citations/:id` | Lấy đoạn trích | `CitationPayload` |
| POST | `/citations/:id/flag` | Flag citation | `FlagRequest`, `AuditEvent` |
| GET | `/episodes/:id` | Episode summary + prediction | `EpisodeSummary` |
| POST | `/episodes/:id/explanation` | Sinh giải thích | `ExplanationRequest`, `ExplanationPayload` |
| GET | `/templates?active=true` | Template active | `TemplateList` |
| GET | `/templates/:id` | Template detail + schema | `Template` |
| POST | `/drafts` | Tạo draft mới | `CreateDraftRequest`, `DraftReport` |
| GET | `/drafts/:id` | Draft detail | `DraftReport` |
| PATCH | `/drafts/:id` | Cập nhật field | `PatchDraftRequest`, `DraftReport` |
| POST | `/drafts/:id/transition` | Chuyển trạng thái | `TransitionRequest`, `DraftReport` |
| GET | `/drafts/:id/audit` | Audit timeline | `AuditTimeline` |
| GET | `/documents` | Knowledge list (read-only MVP) | `DocumentList` |
| POST | `/telemetry` | Batch telemetry | `TelemetryBatch` |

### 9.3. Mẫu schema Zod cho `DraftReport`

```ts
// features/draft-report/schema.ts
import { z } from 'zod'

export const FieldDataSource = z.enum(['ai', 'auto', 'manual', 'locked'])
export const FieldStatus = z.enum(['ok', 'warning', 'evidence_missing', 'needs_review'])

export const DraftField = z.object({
  id: z.string(),
  label: z.string(),
  value: z.unknown(),
  dataType: z.enum(['text', 'number', 'date', 'enum', 'boolean']),
  dataSource: FieldDataSource,
  status: FieldStatus,
  required: z.boolean(),
  citations: z.array(z.string()).default([]),
  warning: z.string().optional(),
  history: z.array(z.object({
    at: z.string().datetime(),
    by: z.string(),
    from: z.unknown(),
    to: z.unknown(),
    reason: z.string().optional(),
  })).default([]),
})

export const DraftStatus = z.enum([
  'draft', 'under_review', 'edited', 'approved', 'rejected', 'archived',
])

export const DraftReport = z.object({
  id: z.string(),
  episodeId: z.string(),
  templateId: z.string(),
  templateVersion: z.string(),
  modelVersion: z.string(),
  status: DraftStatus,
  fields: z.array(DraftField),
  warnings: z.array(z.string()).default([]),
  createdBy: z.string(),
  createdAt: z.string().datetime(),
  updatedBy: z.string(),
  updatedAt: z.string().datetime(),
})

export type DraftReport = z.infer<typeof DraftReport>
export type DraftField = z.infer<typeof DraftField>
```

### 9.4. Cấu hình swap backend
- ENV `NEXT_PUBLIC_API_MOCKING`: `enabled | disabled`.
- ENV `NEXT_PUBLIC_API_BASE_URL`: ví dụ `https://api.benhvien.local/v1`.
- Khi backend thật về:
  1. Backend implement OpenAPI tương ứng schema Zod.
  2. Set `NEXT_PUBLIC_API_MOCKING=disabled`.
  3. Smoke test E2E (đã có sẵn).
  4. Nếu shape lệch → viết adapter trong `lib/api/adapters/<endpoint>.ts`, **cấm** sửa Zod schema trừ khi có RFC.

### 9.5. Cấu hình gắn model AI (later)
- Backend chịu trách nhiệm gọi model; frontend **không** gọi trực tiếp model.
- Endpoint `/episodes/:id/explanation` và `/drafts` là điểm gắn model — mọi response phải tuân thủ schema và đi qua **policy engine** ở backend trước khi về UI.
- UI **không** phụ thuộc model version cụ thể, chỉ hiển thị `modelVersion` string.
- Mọi metadata (uncertainty, evidence payload, explainability map) phải được phẳng hoá trong response.

---

## 10. Component library MVP

### 10.1. Layer tổ chức

| Layer | Ví dụ | Quy tắc |
| --- | --- | --- |
| Primitive (shadcn) | `Button`, `Dialog`, `Tabs` | Không chứa logic nghiệp vụ |
| Medical primitive | `PatientContextBar`, `ProvenanceChip`, `IntendedUseTag` | Không phụ thuộc feature, có Storybook đầy đủ |
| Feature component | `AnswerCard`, `FormEditor` | Sống trong `features/<name>/components/` |
| Composite screen | Trang Next | Chỉ ráp feature component, không style ad-hoc |

### 10.2. Bắt buộc Storybook cho

- Toàn bộ medical primitive.
- Ít nhất 1 story per feature component cho 5 state: default, loading, empty, error, blocked.
- Story "edge case" cho `AnswerCard` (refused, citation missing) và `FormEditor` (locked field, evidence missing).

### 10.3. Component contract mẫu

```ts
// components/medical/AnswerCard.tsx
export interface AnswerCardProps {
  answer: AnswerPayload
  onCitationOpen: (citationId: string) => void
  onFeedback: (kind: FeedbackKind) => void
  onUseInNote?: () => void
  state: 'idle' | 'searching' | 'answered' | 'refused' | 'failed'
  warning?: WarningKind
  className?: string
}
```

---

## 11. State management strategy

### 11.1. Phân chia
- **Server state** (data từ API): TanStack Query, key theo `[domain, id, params]`.
- **Client state**:
  - Form state → React Hook Form (cục bộ trong feature).
  - Cross-component UI state (drawer mở/đóng, focus field) → Zustand store theo feature.
  - Global state (auth, role, feature flags) → Zustand `useAuthStore`.
- **URL state** (filter, tab active, drawer params): query string + `useSearchParams`.

### 11.2. Cấm
- Không lưu PHI vào localStorage.
- Không lưu draft đang chỉnh sửa vào localStorage trừ khi có policy `autosave: true`.
- Không sync auth token sang storage thường — chỉ httpOnly cookie ở backend.

### 11.3. Optimistic update
- Bật cho: feedback, mark as read.
- Tắt cho: approve, reject, transition status (vì cần audit event server-side trả lại id).

### 11.4. Cache invalidation
- Sau approve/reject → invalidate `['drafts', id]` và `['dashboard', 'widgets']`.
- Sau flag citation → invalidate `['answer', queryId]` và `['dashboard', 'flagged']`.
- Document update → invalidate `['documents']` và mọi query có citation liên quan.

---

## 12. Testing strategy & test cases

### 12.1. Pyramid

| Tầng | Tool | Coverage |
| --- | --- | --- |
| Unit | Vitest + RTL | ≥ 70% lines on `lib/` và `features/*/hooks/` |
| Component | Vitest + RTL | Mọi medical primitive + feature component |
| Integration | Vitest + MSW | Mọi feature `api.ts` + state machine |
| E2E | Playwright | Tất cả journey + safety scenario |
| Visual | Storybook + Chromatic (optional) | Medical primitive |
| A11y | axe-core trong Storybook + Playwright | 0 violation Critical |

### 12.2. Danh sách test case

#### Infra
- **TC-INFRA-01**: `pnpm dev/lint/typecheck/test/build` đều pass.
- **TC-INFRA-02**: PR mới block khi CI fail.

#### Design system
- **TC-DS-01**: Token CSS resolve đúng giá trị; không có magic value trong code.
- **TC-DS-02**: shadcn primitive render đủ variant trong Storybook.

#### Mock & API
- **TC-MOCK-01**: Bật MSW thì handler trả mock; tắt thì hit real URL.
- **TC-API-01**: `apiClient` xử lý đúng 200/4xx/5xx và map sang `ApiError`.

#### RBAC
- **TC-RBAC-01**: `clinician` không thấy menu Compare Models.
- **TC-RBAC-02**: `researcher` truy cập trực tiếp URL `/compare` thì chuyển sang trang permission denied.

#### Telemetry
- **TC-TEL-01**: Hook emit event với payload đúng schema.
- **TC-TEL-02**: Event S02 đầy đủ 4 loại theo Section 9 wireflow.
- **TC-TEL-03**: Coverage 22 event = 100%.

#### Navigation
- **TC-NAV-01**: Mỗi link sidebar dẫn đến đúng route, breadcrumb update.

#### Component
- **TC-COMP-01**: `PatientContextBar` render `dataStatus` warning đúng icon.
- **TC-COMP-02**: `ProvenanceChip` mở popover, ESC đóng, focus trở về.
- **TC-COMP-03**: `WarningBanner` 6 loại, có icon + label.
- **TC-COMP-04**: `StatusChip` và `FieldBadge` đủ variant theo bảng 6.2 và 6.3.

#### S00 Login
- **TC-S00-01**: Đăng nhập đúng → đến dashboard.
- **TC-S00-02**: Sai password → hiện lỗi không leak chi tiết.
- **TC-S00-03**: Auth service down → empty state với incident id.
- **TC-S00-04**: 4 role mỗi role landing khác nhau.

#### S01 Dashboard
- **TC-S01-01**: Render đủ 6 widget.
- **TC-S01-02**: Filter theo khoa phòng cập nhật worklist.
- **TC-S01-03**: Click "Drafts pending" → S05 với draft preload.
- **TC-S01-04**: Widget "System health" fail vẫn không sập trang.
- **TC-S01-05**: Empty state khi không có task.
- **TC-S01-06**: Role không đủ quyền → widget bị ẩn không vỡ layout.
- **TC-S01-07**: `Ctrl+K` mở quick search.
- **TC-S01-08**: Alert nghiêm trọng không tự dismiss.

#### S02 Knowledge Query
- **TC-S02-01**: Query rỗng/quá dài → block submit.
- **TC-S02-02**: Filter chip cập nhật query payload.
- **TC-S02-03**: Submit đúng → state `searching` rồi `answered`.
- **TC-S02-04**: AnswerCard render đầy đủ: tag, model version, timestamp, warning, citation, feedback.
- **TC-S02-05**: Click citation mở drawer trong ≤ 2 thao tác.
- **TC-S02-06**: Out-of-scope → state `refused` với microcopy chuẩn.
- **TC-S02-07**: Insufficient evidence → state `refused`.
- **TC-S02-08**: Lỗi 5xx → state `failed` với incident id + retry.
- **TC-S02-09**: Citation load fail → badge `Outdated/Unavailable`.
- **TC-S02-10**: Flag citation tạo audit event và không mất answer.

#### S03 Episode Workspace
- **TC-S03-01**: Episode summary render đúng từ fixture.
- **TC-S03-02**: Prediction card hiện model version + disclaimer.
- **TC-S03-03**: Uncertainty cao → tự gắn warning banner.
- **TC-S03-04**: Thiếu explainability payload → button explanation disable + tooltip.
- **TC-S03-05**: Explanation panel tách khu evidence và diễn giải, không hiện reasoning thô.
- **TC-S03-06**: Draft đang bị người khác sửa → mở read-only.
- **TC-S03-07**: Rời episode khi có thay đổi chưa lưu → unsaved changes guard.

#### S04 Template Selection
- **TC-S04-01**: Chỉ template active hiển thị.
- **TC-S04-02**: Preview field count, intended use, last approved version.
- **TC-S04-03**: Template hết hiệu lực giữa lúc mở modal → block tạo draft.
- **TC-S04-04**: Tạo draft thành công → navigate S05 với draft mới.

#### S05 Draft Review
- **TC-S05-01**: Filter `Warnings` chỉ hiện field có risk; count đúng.
- **TC-S05-02**: Filter `Required` đếm đúng số required.
- **TC-S05-03**: Edit field AI → badge tự đổi sang `Manual`.
- **TC-S05-04**: Field `Locked` không cho edit, có cursor not-allowed.
- **TC-S05-05**: Edit history per field log đủ from/to/at/by.
- **TC-S05-06**: Click field → ProvenanceDrawer hiện citation đúng; phím tắt `P` toggle.
- **TC-S05-07**: Diff toggle 3 mode chuyển đúng.
- **TC-S05-08**: Filter "chỉ field đã đổi" hoạt động.
- **TC-S05-09**: Draft có blocker warning → approve disable.
- **TC-S05-10**: Send for review → status `under_review`.
- **TC-S05-11**: Transition không hợp lệ throw error có code.
- **TC-S05-12**: Concurrent edit → banner xung đột + reload diff.

#### S06 Approval/Rejection Modal
- **TC-S06-01**: Approve modal hiện đủ summary + 2 checkbox bắt buộc.
- **TC-S06-02**: Submit success quay về S05 status `approved`.
- **TC-S06-03**: Submit fail giữ nguyên data + incident id.
- **TC-S06-04**: Reject yêu cầu lý do bắt buộc.
- **TC-S06-05**: Category dropdown đủ 6 giá trị.
- **TC-S06-06**: Tạo audit event `rejection_confirmed`.

#### Security
- **TC-SEC-01**: Markdown render không thực thi script (XSS).
- **TC-SEC-02**: Không lưu PHI vào localStorage.
- **TC-SEC-03**: URL query không chứa episodeId raw nếu policy yêu cầu redact.

#### A11y
- **TC-A11Y-01**: Storybook a11y addon: 0 violation Critical.
- **TC-A11Y-02**: Drawer có focus trap, Esc đóng, focus trở về element trigger.
- **TC-A11Y-03**: Lighthouse a11y ≥ 95 trên dashboard và S05.
- **TC-A11Y-04**: Hoàn thành flow approve hoàn toàn bằng bàn phím.
- **TC-A11Y-05**: Trạng thái warning/error có cả icon + label.

#### Performance
- **TC-PERF-01**: LCP < 2.5s, CLS < 0.1, FID < 100ms ở dashboard và S05.
- **TC-PERF-02**: Bundle initial < 300 KB gzipped (route-level code split).

#### Error
- **TC-ERR-01**: Crash 1 widget → ErrorBoundary fallback, các widget khác vẫn render.
- **TC-ERR-02**: Network offline → toast retry, không mất dữ liệu form.

#### E2E (Playwright)
- **TC-E2E-A**: Journey A — Bác sỹ từ dashboard → episode → template → draft → approve. Patient context không mất ở bất kỳ bước nào.
- **TC-E2E-B**: Journey B — Flag citation từ query → audit event xuất hiện trong audit page.
- **TC-E2E-C**: Journey C — QA mở compare (stub) → label disagreement (stub) — chỉ verify navigation và RBAC.
- **TC-E2E-S1**: Out-of-scope query bị block tại S02.
- **TC-E2E-S2**: Draft missing evidence không cho approve tại S05/S06.
- **TC-E2E-S3**: User không đủ quyền mở `/compare` chuyển permission denied.
- **TC-E2E-S4**: Tài liệu superseded có badge rõ.
- **TC-E2E-S5**: Refresh giữa lúc chỉnh sửa draft → unsaved changes guard.

### 12.3. Test data fixture
- Đặt tại `lib/mocks/fixtures/`.
- Mỗi fixture là JSON, **không** chứa PHI thật, có comment rõ "synthetic".
- Có ít nhất 1 fixture cho mỗi state nghiệp vụ: `episode-complete`, `episode-mismatch`, `draft-missing-evidence`, `draft-blocker-warning`.

---

## 13. Accessibility checklist

| Mã | Yêu cầu | Trạng thái MVP |
| --- | --- | --- |
| A11Y-01 | Contrast WCAG AA cho text và component chính | Bắt buộc |
| A11Y-02 | Mọi action review qua được bàn phím | Bắt buộc |
| A11Y-03 | Warning/error/approved không chỉ phân biệt bằng màu | Bắt buộc |
| A11Y-04 | Drawer/modal/compare có focus management đúng | Bắt buộc |
| A11Y-05 | Font size + line height phù hợp đọc evidence dài | Bắt buộc |
| A11Y-06 | Screen reader label cho button quan trọng | Bắt buộc |
| A11Y-07 | Skip link "Bỏ qua đến nội dung chính" | Bắt buộc |
| A11Y-08 | Live region announce cho toast/alert | Khuyến nghị |
| A11Y-09 | Reduce motion respect `prefers-reduced-motion` | Khuyến nghị |

---

## 14. Performance budget

| Chỉ số | Ngưỡng MVP |
| --- | --- |
| LCP | < 2.5s |
| CLS | < 0.1 |
| INP | < 200ms |
| Bundle initial gzipped | < 300 KB |
| Bundle per route gzipped | < 150 KB |
| Time to first evidence | ≤ 10s (KPI sản phẩm) |
| Dashboard render từ cold | ≤ 2s mạng nội bộ |

Cách enforce:
- `next/bundle-analyzer` trong CI.
- Lighthouse CI chạy trên dashboard + S05.
- Image: dùng `next/image`, lazy load mặc định.
- Heavy component (`FormEditor`, diff view) dynamic import.

---

## 15. Definition of Done (per task)

Mỗi task đóng khi đủ:

- [ ] Code đã merge vào branch chính sau review.
- [ ] Tất cả AC trong task đều pass.
- [ ] Test case liên quan pass trên CI.
- [ ] Không tạo TypeScript error / ESLint error.
- [ ] Storybook story (nếu là UI) cập nhật + a11y check pass.
- [ ] Telemetry event (nếu yêu cầu) đã emit đúng.
- [ ] Documentation cập nhật (`docs/` hoặc README feature).
- [ ] Empty/Loading/Error/Blocked state đầy đủ.
- [ ] Microcopy lấy từ `lib/constants/microcopy.ts`, không hard-code.
- [ ] Review checklist self-review:
  - [ ] Không leak PHI lên URL/localStorage/console.
  - [ ] Không hiển thị chain-of-thought.
  - [ ] AI content có badge.
  - [ ] Provenance hiện đúng nơi.
  - [ ] Fail-closed nếu thiếu data.

---

## 16. Risks & Mitigations

| Rủi ro | Mức độ | Giảm thiểu |
| --- | --- | --- |
| Backend chậm về → frontend chờ | Cao | Mock-driven, contract Zod đầu tiên |
| Schema backend lệch khi tích hợp | Trung | Adapter layer + smoke test E2E |
| Overtrust UI cho AI | Cao | Badge AI, banner intended use, approval gate |
| Alert fatigue | Trung | Phân cấp warning, ưu tiên blocker |
| Compare mode leak vào luồng lâm sàng | Trung | RBAC chặt + URL guard + middleware |
| PHI leak qua log/URL | Cao | Util `redact()` bắt buộc, ESLint rule cấm `console.log` ở production |
| Performance suy giảm khi data thật về | Trung | Performance budget CI gate, virtual list cho danh sách dài |
| Accessibility miss | Trung | A11y addon Storybook + Lighthouse CI |
| Concurrent edit conflict | Trung | Polling/version check + diff reload |
| Drift schema giữa frontend và backend | Cao | OpenAPI làm nguồn duy nhất, gen type tự động (nếu có thể), lock version |

---

## 17. Quyết định mở (cần chốt sớm)

Liệt kê để team chốt trong Sprint 0 - 1:

- Danh sách template form ưu tiên cho MVP (radiology draft? hội chẩn?).
- Vai trò nào được phê duyệt từng loại template?
- Có cần Word/PDF export ở MVP hay phase 2?
- Compare mode mở cho researcher hay chỉ QA/admin?
- Review theo section hay theo từng field cho template dài?
- Có tích hợp SSO benh viện ngay MVP hay dùng mock?
- Audit viewer tập trung MVP hay phase 2?
- Telemetry endpoint thật hay file log?
- Có cần dark mode?
- Ngôn ngữ MVP: chỉ tiếng Việt hay song ngữ?

---

## 18. Tài liệu liên quan

- `docs/yeu_cau_he_thong_rag.md` — Yêu cầu hệ thống đầy đủ (functional + safety + governance).
- `docs/prd_ui_flow_y_te_rag.md` — PRD UI/UX với 8 nguyên tắc MED, KPI, microcopy.
- `docs/wireflow_screen_by_screen_ui_rag.md` — Wireflow chi tiết 11 màn hình S00–S11.
- `note/de_cuong_nghien_cuu.md` — Đề cương nghiên cứu, kiến trúc kỹ thuật.
- `note/bmj.md` — TRIPOD+AI guidance.
- `note/doc2.md` — SPIRIT-AI / CONSORT-AI.
- `note/doc4.md` — Multimodal AI cho viêm phổi Nhi.

---

## 19. Kết luận và bước tiếp theo

Tài liệu này biến yêu cầu nghiệp vụ và an toàn y tế từ 3 file đặc tả `docs/` thành một kế hoạch triển khai khả thi cho frontend MVP, có thể bắt đầu **ngay Sprint 0** mà không phụ thuộc backend hay model thật.

**Bước tiếp theo đề xuất**:

1. Chốt **Section 17** (quyết định mở) trong cuộc họp kickoff.
2. Khởi tạo repo theo **Section 4** và setup CI theo **[S0-T01..S0-T02]**.
3. Implement **Sprint 0** trong 2 tuần đầu, demo Storybook design tokens cho team UX kiểm tra.
4. Song song: BA viết test case chi tiết theo **Section 12** vào hệ Jira/Linear.
5. Khi backend bắt đầu: review schema **Section 9** với team backend, đồng ý OpenAPI làm source of truth.
6. Khi model AI sẵn sàng tích hợp: chỉ cần backend gọi model và trả response đúng schema — frontend không thay đổi.

Tài liệu sẽ được cập nhật theo từng Sprint Retro và mọi quyết định quan trọng (RFC) sẽ được log vào `docs/decisions/` (đề xuất tạo folder mới).
