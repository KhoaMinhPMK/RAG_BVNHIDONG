# CAE AI UX Implementation Backlog

## 0. Mục tiêu

Backlog này chuyển UX spec thành các workstream triển khai cụ thể theo thứ tự `P0`, `P1`, `P2`. Mỗi item được viết bám vào trạng thái code hiện tại trong `apps/web`, `apps/api`, `docs`, và `packages/db`.

Mục tiêu của backlog không phải chỉ làm giao diện đẹp hơn. Mục tiêu là:

- làm cho flow AI/LLM hiện tại thành thật với người dùng;
- dựng nền contract và data model cho các bề mặt UX mới;
- giảm fallback/mock trên surface lâm sàng;
- tạo được một lớp trải nghiệm CAE có cấu trúc, có bằng chứng, có spatial linking, và có review workflow thực tế.

---

## 1. Giả định triển khai

1. Source of truth cho runtime hiện nghiêng về `chunks`, `documents`, `match_document_chunks`, và migration trong `packages/db`.
2. `apps/web/src/app/cases/[id]/page.tsx`, `apps/web/src/components/cae/CAEDock.tsx`, `apps/web/src/components/cae/EvidenceRail.tsx`, `apps/web/src/components/cae/BlockRenderer.tsx`, `apps/web/src/hooks/useCAEStream.ts`, và `apps/web/src/lib/spatial-focus.ts` là các foundation frontend hiện có cần ưu tiên harden và nối lại với nhau.
3. `apps/api/src/routes/query.ts`, `apps/api/src/routes/explain.ts`, `apps/api/src/routes/draft.ts`, `apps/api/src/routes/cae.ts`, `apps/api/src/routes/detect.ts` là các route chính của AI workflow.
4. Multi-provider đã có adapter nhưng chưa đưa vào orchestration runtime đầy đủ.
5. Redis cache và rate-limit đã có library nhưng chưa được cắm vào đường nóng.

### Lưu ý trạng thái code hiện tại

- Dock shell đã tồn tại dưới dạng `CAEDock`, không còn là ý tưởng thuần.
- Evidence rail đã tồn tại ở mức source-card list, filter, sort, trust badge.
- Structured block renderer đã tồn tại ở mức `summary`, `paragraph`, `bullet_list`, `warning`, `table`, `evidence_digest`, `field_patch`.
- Spatial focus controller đã tồn tại ở mức utility/hook, nhưng chưa được wire end-to-end vào viewport interaction.
- Vì vậy backlog bên dưới phải được hiểu là backlog hardening/orchestration, không phải backlog tạo mới từ số 0.

---

## 2. P0 — Bắt buộc trước khi polish UX

P0 là nhóm việc phải làm trước khi Dock, Rail, Spatial Focus, và Draft Composer trở thành workflow layer thật. Nếu không hoàn tất P0, UX mới sẽ chỉ là vỏ đẹp cho một flow chưa kín.

### P0.1. Làm flow case view thành thật với backend thật

#### P0-01 — Sửa query contract giữa frontend và backend

- Mục tiêu: không để panel hỏi tri thức ở case view rơi về fallback local do thiếu `role`.
- Frontend files:
  - `apps/web/src/lib/api/client.ts`
  - `apps/web/src/app/cases/[id]/page.tsx`
- Backend files:
  - `apps/api/src/routes/query.ts`
  - `apps/api/src/types/api.ts` nếu cần chuẩn hóa role payload.
- Việc cần làm:
  - bổ sung `role` vào `queryKnowledge()` request payload;
  - lấy role từ auth context hoặc truyền qua typed param thay vì hardcode ngầm;
  - thay error handling hiện tại để surface lỗi thật, không rơi về mock im lặng.
- Acceptance criteria:
  - hỏi trong Explain panel gọi được backend thật;
  - không còn rơi vào `getKnowledgeReply()` khi backend chỉ trả 4xx do thiếu role;
  - hiển thị state `Không truy xuất được từ CAE` khi route lỗi thật.

#### P0-02 — Loại bỏ fallback/mock hiển thị ra người dùng trong Explain và Draft

- Mục tiêu: surface lâm sàng không được giả như thành công nếu backend thất bại.
- Frontend files:
  - `apps/web/src/app/cases/[id]/page.tsx`
- Việc cần làm:
  - bỏ `getKnowledgeReply()` fallback khỏi flow người dùng cuối;
  - bỏ `Fallback to mock` trong Draft panel;
  - thay bằng error card, degraded card, no-evidence card.
- Acceptance criteria:
  - không còn output mock trên case view khi backend lỗi;
  - QA có thể phân biệt `backend trả lời`, `không đủ bằng chứng`, `route lỗi`, `provider fallback`.

#### P0-03 — Tách detection runtime thành detector adapter chuẩn

- Mục tiêu: route detection đang mount thật không được tiếp tục gắn chặt với mock logic trong UI roadmap mới.
- Backend files:
  - `apps/api/src/routes/detect.ts`
  - `apps/api/src/index.ts`
  - file mới: `apps/api/src/lib/detection/adapter.ts`
- Việc cần làm:
  - giữ mock làm fallback nội bộ nhưng bọc sau adapter;
  - tạo contract chuẩn cho detection result, finding anchors, model metadata;
  - chuẩn bị trả `findingId`, `bbox`, `confidence`, `imageId` nhất quán cho Spatial Focus.
- Acceptance criteria:
  - `detect.ts` không còn chứa logic mock là tuyến chính;
  - frontend nhận được result shape ổn định cho future spatial linking.

### P0.2. Dựng contract UI có cấu trúc cho AI output

#### P0-04 — Chuẩn hóa `RenderableBlock`, `CitationAnchor`, `UIAction`, `FieldPatch`

- Mục tiêu: AI output không còn bị coi là text trần.
- Backend files:
  - `apps/api/src/types/api.ts`
  - `apps/api/src/agents/cae.ts`
  - `apps/api/src/agents/knowledge.ts`
  - `apps/api/src/agents/explainer.ts`
  - `apps/api/src/agents/reporter.ts`
- Frontend files:
  - `apps/web/src/types/cae-output.ts`
- Việc cần làm:
  - đồng bộ contract backend với `apps/web/src/types/cae-output.ts` hiện có thay vì tạo type song song mới;
  - support fallback `paragraph` block khi agent chưa trả cấu trúc đầy đủ;
  - mở rộng `UIAction` để Dock, viewport, Evidence Rail, và Draft Composer cùng dùng được.
- Acceptance criteria:
  - ít nhất CAE brief, Explain answer, và Draft patches cùng đi qua block/action contract;
  - types frontend và backend khớp.

#### P0-05 — Mở rộng `BlockRenderer` hiện có thành renderer chuẩn cho AI workflow

- Frontend files:
  - `apps/web/src/components/cae/BlockRenderer.tsx`
  - file mới nếu cần: `apps/web/src/components/cae/blocks/*`
- Việc cần làm:
  - giữ renderer đang có cho `summary`, `paragraph`, `bullet_list`, `warning`, `table`, `field_patch`;
  - thêm block cho compare, metric, empty state, question, patch bundle;
  - bỏ render trực tiếp bằng `whitespace-pre-wrap` làm đường chính;
  - tách block layout khỏi chat container.
- Acceptance criteria:
  - CAE brief không còn chỉ là paragraph raw;
  - output table, warning, field patch, và compare state có component riêng.

### P0.3. Dựng Dock shell trước khi polish nội dung

#### P0-06 — Nâng `CAEDock` hiện có thành orchestration shell thật

- Frontend files:
  - `apps/web/src/components/cae/CAEDock.tsx`
  - file mới: `apps/web/src/components/cae/useDockState.ts`
- Việc cần làm:
  - giữ state machine `collapsed`, `peek`, `task`, `focus`, `compose`, `pinned` đang có và tách nó khỏi local UI logic rải rác;
  - thêm routing theo `UIAction`, per-run state, task strip, và pin semantics rõ hơn;
  - giữ brief/chat logic cũ nhưng biến Dock thành host cho nhiều task run thay vì một stream duy nhất.
- Acceptance criteria:
  - Dock có thể collapse and expand không cần remount toàn bộ nội dung;
  - có pin and unpin;
  - Dock có thể phản ứng theo run type mà không làm vỡ flow hiện tại.

#### P0-07 — Biến Dock trong case layout thành workflow layer thay vì panel phụ

- Frontend files:
  - `apps/web/src/app/cases/[id]/page.tsx`
- Việc cần làm:
  - giữ `CAEDock` đã mount trong case view nhưng đổi vai trò của nó từ panel trên cùng sang layer orchestration cho Explain/Draft/viewport;
  - bảo đảm dock không chiếm chiều cao cứng làm chật Explain hoặc Draft;
  - giữ fullscreen image hoạt động bình thường.
- Acceptance criteria:
  - dock có thể thu gọn mà không làm vỡ bước Detection, Explain, Draft;
  - workspace không bị chia thành cột dọc chật như hiện tại;
  - task, evidence, spatial focus có thể chi phối case view thay vì đứng tách rời.

### P0.4. Dựng nền cho Evidence Rail và Spatial Focus

#### P0-08 — Mở rộng `EvidenceRail` hiện có thành evidence workspace thật

- Frontend files:
  - `apps/web/src/components/cae/EvidenceRail.tsx`
  - file mới: `apps/web/src/components/cae/useEvidenceRail.ts`
- Việc cần làm:
  - giữ source cards, filters, sort hiện có;
  - nhóm citations theo claim, finding, patch, hoặc run;
  - map citation từ Explain, Query, Draft về model chung;
  - thay popup cũ dần dần bằng rail interaction chuẩn.
- Acceptance criteria:
  - explain step có rail cố định hoặc bán cố định;
  - popup cũ chỉ còn fallback hoặc bị loại bỏ.

#### P0-09 — Wire `SpatialFocusController` hiện có vào case viewport end-to-end

- Frontend files:
  - `apps/web/src/app/cases/[id]/page.tsx`
  - `apps/web/src/lib/spatial-focus.ts`
  - file mới nếu cần: `apps/web/src/components/case/useViewportCamera.ts`
- Việc cần làm:
  - tận dụng camera stack, focus/restore, cancel-on-user-interaction đang có;
  - nối citation hover, citation click, finding click, và draft patch focus vào cùng một controller;
  - phân biệt hover preview với committed focus.
- Acceptance criteria:
  - click finding hoặc citation có thể zoom tới vùng đó và trở lại trạng thái trước;
  - không có jump camera khó chịu.

### P0.5. Chuyển Draft sang field-and-patch foundation

#### P0-10 — Tách Draft panel hiện tại thành `DraftComposer`

- Frontend files:
  - `apps/web/src/app/cases/[id]/page.tsx`
  - file mới: `apps/web/src/components/draft/DraftComposer.tsx`
  - file mới: `apps/web/src/components/draft/PatchTray.tsx`
  - file mới: `apps/web/src/components/draft/FieldCard.tsx`
- Việc cần làm:
  - giữ fields hiện có nhưng thay layout bằng field column và patch tray;
  - chat chỉ còn là secondary action;
  - thêm badge `AI`, `needs review`, `manual`, `locked`.
- Acceptance criteria:
  - Draft không còn đặt chat làm trung tâm;
  - patch accept or reject trở thành interaction chính.

#### P0-11 — Chuẩn hóa reporter output thành patch-ready data

- Backend files:
  - `apps/api/src/agents/reporter.ts`
  - `apps/api/src/routes/draft.ts`
- Việc cần làm:
  - thêm payload patch-ready cho field provenance, rationale, confidence, citations;
  - không chỉ trả `fields` raw.
- Acceptance criteria:
  - frontend có đủ dữ liệu để render patch tray không cần suy luận từ text.

### P0.6. Schema và observability tối thiểu

#### P0-12 — Chốt một schema runtime source of truth

- Files:
  - `packages/db/src/migrations/001_initial_schema.sql`
  - `apps/api/src/lib/supabase/schema.sql`
  - docs liên quan nếu cần redirect.
- Việc cần làm:
  - xác định file schema nào là chuẩn runtime;
  - loại bỏ hoặc ghi deprecate file drift;
  - đồng bộ naming `documents`, `chunks`, `match_document_chunks`.
- Acceptance criteria:
  - team không còn ambiguity giữa `chunks` và `document_chunks`.

#### P0-13 — Thêm logging cho AI run và retrieval trace tối thiểu

- Backend files:
  - file mới: `apps/api/src/lib/telemetry/ai-runs.ts`
  - `apps/api/src/routes/query.ts`
  - `apps/api/src/routes/explain.ts`
  - `apps/api/src/routes/draft.ts`
  - `apps/api/src/routes/cae.ts`
- Việc cần làm:
  - log `request_id`, provider, model, latency, fallback, citations count, no-evidence state;
  - chuẩn bị ground cho analytics UX sau này.
- Acceptance criteria:
  - mỗi run AI chính có telemetry record cơ bản.

---

## 3. P1 — Hoàn thiện trải nghiệm chính

P1 là giai đoạn biến foundation thành trải nghiệm thật sự mượt, có trust surface tốt, và có memory giữa các bước.

### P1.1. Dock intelligence và micro-interaction

#### P1-01 — Thêm auto-open and auto-collapse heuristics cho Dock

- Frontend files:
  - `apps/web/src/components/cae/useDockState.ts`
- Việc cần làm:
  - mở dock ở `peek` khi có brief mới hoặc warning mới;
  - chuyển lên `task` hoặc `focus` theo UIAction;
  - collapse sau timeout nếu user không tương tác;
  - respect pin state.
- Acceptance criteria:
  - dock không còn là khối luôn mở hoặc luôn đóng; hành vi phù hợp theo step.

#### P1-02 — Chuyển chat transcript sang `task cards`

- Frontend files:
  - `apps/web/src/components/cae/CAEDockShell.tsx`
  - file mới: `apps/web/src/components/cae/TaskCard.tsx`
- Việc cần làm:
  - gom mỗi lượt hỏi thành card;
  - summary first, details on demand;
  - hiển thị source count và confidence ở lớp phụ.
- Acceptance criteria:
  - panel không còn kéo dài như transcript thô.

### P1.2. Evidence-first reading

#### P1-03 — Anchor sentence to citation and finding

- Frontend files:
  - `AIBlockRenderer`
  - `EvidenceRail`
  - `SpatialFocusController`
- Backend files:
  - agents trả `CitationAnchor`.
- Việc cần làm:
  - highlight sentence đang gắn citation;
  - hover sentence làm sáng nguồn và vùng ảnh liên quan.
- Acceptance criteria:
  - user đi từ câu AI tới bằng chứng và vùng ảnh trong 1-2 thao tác.

#### P1-04 — Conflict banner cho nguồn nội bộ và tham khảo

- Frontend files:
  - `EvidenceRail.tsx`
- Backend files:
  - retrieval layer trả source mix or conflict metadata.
- Acceptance criteria:
  - khi source conflict, UI không còn phẳng hóa thành một câu trả lời đơn giản.

### P1.3. Spatial focus hoàn thiện

#### P1-05 — Fullscreen-compatible focus orchestration

- Frontend files:
  - case viewer and fullscreen viewer trong `apps/web/src/app/cases/[id]/page.tsx`
- Việc cần làm:
  - Spatial Focus dùng chung cho inline viewer và fullscreen viewer;
  - restore state đúng viewer context.
- Acceptance criteria:
  - auto-focus không phá fullscreen flow.

#### P1-06 — Focus explanation chip và pulse overlay

- Frontend files:
  - `SpatialFocusController`
  - `ImagePanel` trong case page.
- Acceptance criteria:
  - khi focus, user hiểu ngay vì sao ảnh đang zoom tới vùng đó.

### P1.4. Draft composer hoàn thiện

#### P1-07 — Patch diff viewer và accept/reject history

- Frontend files:
  - `PatchTray.tsx`
  - `FieldCard.tsx`
  - file mới: `PatchDiffView.tsx`
- Acceptance criteria:
  - patch hiển thị before and after rõ ràng;
  - history patch được lưu ở UI session.

#### P1-08 — Memory liên bước giữa Detection, Explain, Draft

- Frontend files:
  - file mới: `apps/web/src/stores/case-working-set.ts`
  - case page and draft composer.
- Backend files:
  - optional sync payload cho accepted or rejected findings.
- Acceptance criteria:
  - finding bị bác sĩ reject ở detection không còn được Draft đề xuất lại như chưa có gì.

#### P1-09 — Structured blocks cho table, checklist, trend chart

- Frontend files:
  - `AIBlockRenderer`
  - block components mới.
- Acceptance criteria:
  - text tạo ra có thể render bảng và mini chart thay vì text dài thô.

### P1.5. Trust surface và system status

#### P1-10 — Hạ provider toggle khỏi surface lâm sàng

- Frontend files:
  - `apps/web/src/app/cases/[id]/page.tsx`
  - `CAEDockShell`
- Việc cần làm:
  - chuyển provider strategy thành policy, không phải nút cho bác sĩ;
  - surface lâm sàng chỉ còn `CAE ready`, `CAE degraded`, `fallback active`.
- Acceptance criteria:
  - case UX không còn lộ control debug provider cho user thường.

#### P1-11 — Thêm trust footer cho answer và patch

- Frontend files:
  - `TaskCard.tsx`
  - `PatchTray.tsx`
- Nội dung:
  - source mix;
  - model;
  - freshness;
  - fallback;
  - cache hit ở debug mode.

### P1.6. Knowledge ops UI

#### P1-12 — Chia Knowledge page thành 3 mode: quản trị, debug retrieval, quality view

- Frontend files:
  - `apps/web/src/app/knowledge/page.tsx`
  - file mới: `KnowledgeRetrievalDebug.tsx`
  - file mới: `KnowledgeQualityView.tsx`
- Acceptance criteria:
  - không còn chỉ là tài liệu list and upload page;
  - có chunk diagnostics, failure cases, top cited docs, reingest compare view.

### P1.7. Cache và rate limiting trên đường nóng

#### P1-13 — Gắn Redis cache vào embedding, retrieval, doc stats

- Backend files:
  - `apps/api/src/lib/cache/redis.ts`
  - `apps/api/src/agents/knowledge.ts`
  - `apps/api/src/agents/cae.ts`
  - `apps/api/src/routes/documents.ts`
- Acceptance criteria:
  - embedding and retrieval cache có key theo context phù hợp;
  - không cache nhầm giữa source filters, role, provider.

#### P1-14 — Mount rate limit vào route AI thực chiến

- Backend files:
  - `apps/api/src/routes/query.ts`
  - `apps/api/src/routes/explain.ts`
  - `apps/api/src/routes/draft.ts`
  - `apps/api/src/routes/cae.ts`
- Acceptance criteria:
  - AI routes không còn bỏ trống rate-limit capability.

---

## 4. P2 — Tối ưu nâng cao và năng lực nghiên cứu

P2 là giai đoạn đưa hệ thống từ "sản phẩm dùng tốt" lên "hệ thống AI có chiều sâu vận hành và nghiên cứu".

### P2.1. Provider orchestration nâng cao

#### P2-01 — Sequential fallback policy theo use case

- Backend files:
  - `apps/api/src/lib/llm/unified.ts`
  - `apps/api/src/lib/llm/routing-policy.ts` mới
- Việc cần làm:
  - policy khác nhau cho brief, knowledge QA, explain, draft;
  - không dùng một rule cho mọi agent.

#### P2-02 — Đưa multi-LLM racing vào compare or shadow mode, không bật đại trà

- Backend files:
  - `apps/api/src/lib/llm/racing.ts`
  - telemetry tables and routes.
- Acceptance criteria:
  - racing chỉ bật khi có logging, compare, quality review đầy đủ.

### P2.2. Observability và feedback loop trưởng thành

#### P2-03 — Tạo bảng `cae_sessions`, `cae_messages`, `retrieval_traces`, `llm_runs`, `draft_revisions`, `user_feedback`

- Files:
  - `packages/db/src/migrations/*` mới
- Acceptance criteria:
  - mọi answer hoặc patch quan trọng truy vết được end to end.

#### P2-04 — Dashboard analytics cho AI UX

- Frontend files:
  - knowledge quality mode and admin or ops views.
- Metrics:
  - time to first evidence;
  - fallback rate;
  - acceptance rate per patch type;
  - citation click-through;
  - edit distance AI vs final.

### P2.3. Spatial UX nâng cao

#### P2-05 — Multi-finding narrative mode

- Mục tiêu: khi AI mô tả nhiều finding, user có thể step through từng vùng như slideshow có evidence.

#### P2-06 — Confidence-aware focus behavior

- Mục tiêu: focus animation và highlight intensity thay đổi theo confidence band.

### P2.4. Draft UX nâng cao

#### P2-07 — Batch accept or reject và field locking policy

- Mục tiêu: bác sĩ duyệt nhanh nhiều patch cùng loại nhưng vẫn có kiểm soát.

#### P2-08 — Structured export readiness

- Mục tiêu: chuẩn bị block data để export PDF or Word về sau mà không phải parse ngược text.

### P2.5. Knowledge operations nâng cao

#### P2-09 — Candidate review queue và document sourcing queue thật

- Files:
  - knowledge ops UI
  - source queue backend
- Acceptance criteria:
  - không còn queue hardcode 0;
  - có thao tác approve or reject candidate.

---

## 5. Tổ chức thực hiện theo workstream

### Workstream A — Product and UX

- chốt state machine cho Dock;
- chốt model block renderer;
- chốt trust hierarchy giữa Dock, Rail, Task Surface.

### Workstream B — Frontend foundation

- refactor case layout;
- xây Dock shell, Rail shell, Spatial Focus controller, Draft Composer shell;
- thêm renderer cho table, warning, patch diff.

### Workstream C — Backend contracts

- sửa query contract;
- dựng structured response contract;
- detection adapter;
- patch-ready draft payload.

### Workstream D — Data and infra

- schema consolidation;
- AI run logging;
- cache wiring;
- rate limit wiring.

### Workstream E — QA and validation

- scenario tests cho no-evidence, degraded, provider fallback;
- visual regression cho dock states;
- interaction tests cho focus and restore;
- draft patch acceptance and reject flows.

---

## 6. Definition of done theo phase

### Done của P0

- flow case view không còn giả thành công bằng mock fallback;
- CAE output bắt đầu có block contract;
- Dock shell hoạt động được;
- Evidence Rail shell và Spatial Focus foundation có mặt;
- Draft có field and patch foundation;
- schema drift được chặn lại.

### Done của P1

- Dock có auto-open and auto-collapse thông minh;
- rail gắn được với text và ảnh;
- draft composer đủ dùng cho bác sĩ review thật;
- cache and rate limiting vào đường nóng;
- knowledge page có mode debug và quality.

### Done của P2

- orchestration đa provider có policy trưởng thành;
- telemetry và analytics hoàn chỉnh;
- knowledge ops và compare workflows đủ cho nghiên cứu và vận hành.
