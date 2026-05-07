# CAE LLM Workflow Redesign Spec

## 0. Mục tiêu

Spec này bổ sung cho [cae_dock_evidence_spatial_draft_ux_spec.md](./cae_dock_evidence_spatial_draft_ux_spec.md) ở tầng workflow AI/LLM tổng thể.

Spec trước tập trung vào 4 khối lớn: Dock, Evidence Rail, Spatial Focus, Draft Composer. Spec này đi sâu vào một câu hỏi khác: làm thế nào để CAE thôi hành xử như một chat assistant đặt cạnh UI, và trở thành một lớp intelligence điều phối toàn bộ flow đọc ảnh, giải thích, tra cứu bằng chứng, và sửa báo cáo.

Mục tiêu không phải là thêm nhiều animation hay thêm nhiều khối AI. Mục tiêu là:

- biến AI từ transcript thành workflow;
- biến text dài thành kết quả có cấu trúc và có thể hành động;
- biến evidence từ popup phụ thành lớp kiểm chứng trung tâm;
- biến report generation từ chat-first thành field-and-patch review;
- giảm cảm giác AI “chen chỗ” với image viewport;
- giấu những gì chỉ hữu ích cho kỹ sư, giữ lại những gì hữu ích cho bác sĩ.

---

## 1. Đọc trạng thái code hiện tại

### 1.1. Foundation đã có trong code

Frontend hiện đã có một lớp nền quan trọng, không còn ở trạng thái ý tưởng thuần:

- `apps/web/src/components/cae/CAEDock.tsx`
  - đã có state `collapsed`, `peek`, `task`, `focus`, `compose`, `pinned`;
  - đã có summary strip, action zone, evidence rail ở `focus` state;
  - đã có auto-collapse và hover-expand ở mức cơ bản.
- `apps/web/src/components/cae/EvidenceRail.tsx`
  - đã có filter/sort, trust badge, excerpt card, similarity bar, spatial badge.
- `apps/web/src/components/cae/BlockRenderer.tsx`
  - đã render được `summary`, `paragraph`, `bullet_list`, `warning`, `table`, `evidence_digest`, `field_patch`.
- `apps/web/src/types/cae-output.ts`
  - đã có `RenderableBlock`, `CitationAnchor`, `UIAction`, `CAEResponse`, SSE event types.
- `apps/web/src/hooks/useCAEStream.ts`
  - đã stream được `thinking`, tool events, blocks, citations.
- `apps/web/src/lib/spatial-focus.ts`
  - đã có camera stack, auto-focus, restore view, cancel on user interaction.

Nói cách khác: shell đã xuất hiện. Vấn đề bây giờ không còn là “có nên thiết kế Dock/Evidence Rail/Spatial Focus không”, mà là “làm sao buộc chúng thành một hệ workflow đúng nghĩa”.

### 1.2. Gãy ở đâu

Sau khi đọc lại code hiện tại, UX debt chính không nằm ở chuyện thiếu component, mà nằm ở orchestration:

- `apps/web/src/app/cases/[id]/page.tsx` vẫn tổ chức UI theo kiểu các panel tách rời, còn Dock đang nằm như một panel ở đầu cột phải chứ chưa phải workflow layer bao lên case view.
- `page.tsx` vẫn còn sample/fallback content và helper mock, nên trải nghiệm vẫn có nguy cơ “trông như AI thật nhưng thực ra là local fallback”.
- `useCAEStream.ts` đã khai báo `UIAction`, `block_content`, nhưng hiện chưa tiêu thụ chúng để điều khiển Dock, viewport, hay Draft Composer.
- `CAEDock.tsx` mới đang giữ một luồng hiện hành, chưa có task history, chưa có per-run memory, chưa có cards cho từng intent.
- `EvidenceRail.tsx` đang hiển thị source list tốt hơn popup cũ, nhưng vẫn chưa nhóm evidence theo claim, theo run, theo field patch, hay theo finding.
- `spatial-focus.ts` đã sẵn sàng về mặt utility, nhưng chưa được nối thành một interaction chain hoàn chỉnh từ `citation -> finding -> viewport -> restore`.
- `BlockRenderer.tsx` đã tốt hơn raw text, nhưng vẫn thiếu block cho compare, trend, metric, unresolved questions, patch bundle, field status, no-evidence explanation.
- Dock vẫn lộ `thinking` và token metadata khá trực diện; đây là thông tin kỹ thuật, chưa phải clinical UX phù hợp cho surface chính.
- Draft flow vẫn chưa thật sự xoay quanh patch review có provenance theo field.

Kết luận: project không thiếu component. Project thiếu “AI operating model”.

---

## 2. Reframe sản phẩm

### 2.1. CAE không phải chatbot

CAE phải được tái định nghĩa là:

> Một lớp workflow intelligence theo ngữ cảnh ca bệnh, điều phối tóm tắt, điều tra, tra cứu bằng chứng, và đề xuất chỉnh sửa báo cáo.

Điều này kéo theo các hệ quả UX sau:

- ô nhập liệu không còn là trung tâm;
- transcript không còn là đơn vị tổ chức chính;
- mỗi lượt AI phải gắn với một intent lâm sàng rõ ràng;
- mỗi intent phải sinh ra output có cấu trúc và có evidence;
- AI phải điều phối viewport và draft, không chỉ trả lời bằng text.

### 2.2. Đơn vị tương tác chính phải đổi từ “message” sang “task run”

Mỗi tương tác AI trong case view nên được quản lý dưới dạng `task run`.

Một `task run` gồm:

- `run_id`
- `intent`
- `step`
- `status`
- `input_summary`
- `output_summary`
- `blocks[]`
- `citations[]`
- `actions[]`
- `patches[]`
- `focus_targets[]`
- `provider_trace`
- `started_at`, `finished_at`

Ví dụ intent:

- `case_brief`
- `explain_finding`
- `compare_differentials`
- `retrieve_evidence`
- `draft_patch`
- `consistency_check`
- `clarify_missing_data`

Chat chỉ còn là một cách để khởi tạo task run. Nó không còn là container chính để hiển thị kết quả.

---

## 3. Target information architecture

## 3.1. Dock phải có 5 lớp thông tin

### Lớp 1. Handle và state cue

Mục tiêu:

- cho user biết Dock đang ngủ, đang theo dõi, hay đang có việc cần review;
- không chiếm chỗ khi user đang đọc ảnh;
- không bắt user “mở panel để xem có gì mới không”.

Thành phần:

- handle rất hẹp;
- activity pulse rất nhẹ;
- badge đếm task đang chờ review;
- state cue theo severity: `info`, `review`, `warning`, `blocked`.

### Lớp 2. Task strip

Đây là phần thay cho transcript.

Task strip hiển thị các run gần nhất dưới dạng card rút gọn:

- intent label;
- câu summary 1 dòng;
- số evidence;
- trạng thái `running`, `needs review`, `done`, `failed`, `low evidence`;
- anchor tới bước `Detection`, `Explain`, `Draft` liên quan.

Rules:

- chỉ giữ 3-5 task gần nhất ở foreground;
- task cũ được gộp vào “Earlier runs”;
- nếu user hỏi tiếp về cùng một finding hoặc cùng field draft, task mới phải thread vào task cũ thay vì mọc thêm transcript độc lập.

### Lớp 3. Result canvas

Khi mở một task, Dock phải hiển thị “result canvas”, không phải log.

Cấu trúc mặc định của result canvas:

1. Summary block
2. Key claim hoặc answer
3. Evidence digest
4. Caveat hoặc no-evidence note
5. Next action buttons

Với explain flow, canvas cần ưu tiên:

- summary ngắn;
- 2-4 luận điểm chính;
- evidence bundle;
- vùng ảnh liên quan;
- differential hoặc caveat.

Với draft flow, canvas cần ưu tiên:

- field patch list;
- before/after diff;
- rationale;
- citations per patch;
- quick actions `Accept`, `Reject`, `Open field`, `Compare full draft`.

### Lớp 4. Evidence rail

Evidence rail không phải là danh sách document thuần. Nó phải trả lời 4 câu hỏi:

- claim này dựa vào nguồn nào;
- nguồn này là nội bộ hay tham khảo;
- excerpt nào đã được dùng;
- nó gắn với finding hoặc field nào.

Do đó rail phải được nhóm theo `claim group` hoặc `patch group`, không chỉ list phẳng.

Mỗi source card nên có:

- trust level;
- title;
- excerpt;
- effective date/version;
- similarity;
- link tới finding/field patch liên quan;
- trạng thái freshness nếu là guideline nội bộ.

### Lớp 5. Action footer

Action footer không phải chat composer đơn thuần. Nó là command bar theo ngữ cảnh.

Command bar phải hỗ trợ các kiểu action:

- hỏi tự do;
- yêu cầu giải thích finding đang focus;
- yêu cầu so sánh 2 khả năng;
- yêu cầu tạo patch cho field đang mở;
- yêu cầu kiểm tra tính nhất quán toàn draft.

UI nên ưu tiên suggestion chips hơn là một ô text trống vô định.

---

## 4. Dock state machine v2

State machine đang có trong code là đúng hướng, nhưng semantics cần chặt hơn.

### `collapsed`

- chỉ hiển thị handle và activity cue;
- dùng khi user đang tập trung đọc ảnh hoặc viết tay;
- không auto-bật to nếu chỉ có background refresh nhẹ.

### `peek`

- hiển thị summary strip và trạng thái task gần nhất;
- dùng cho brief mới, source warning mới, hoặc patch review mới;
- không mở rail và không hiển thị input lớn.

### `task`

- hiển thị task strip + result canvas cơ bản;
- dùng cho đọc brief, câu hỏi ngắn, hoặc results không cần spatial focus.

### `focus`

- hiển thị result canvas + evidence rail + spatial affordance;
- dùng khi answer có finding anchors, citations, vùng ảnh liên quan.

### `compose`

- dùng cho draft patch review, compare before/after, unresolved field review;
- có patch tray hoặc field stack.

### `pinned`

- không phải state nội dung mà là state chống auto-collapse;
- phải giữ nguyên width/mode trước đó;
- chỉ dùng khi user chủ ý review sâu.

### Auto transition rules

- brief mới: `collapsed -> peek`
- explain có citation + focus target: `task -> focus`
- patch run hoàn tất: `task -> compose`
- user manual pan/zoom hoặc edit draft: không được hijack sang `focus`
- run lỗi hoặc no-evidence: chỉ `peek`, không ép mở to

---

## 5. Spatial UX phải được coi là một chuỗi tương tác hoàn chỉnh

### 5.1. Chuỗi đúng

Chuỗi chuẩn cần là:

`claim -> citation/finding chip -> viewport focus preview -> committed focus -> restore`

Chứ không phải:

`AI nói text -> user tự đọc -> user tự đi tìm vùng ảnh`

### 5.2. Rules cho auto-focus

- hover source card: chỉ highlight nhẹ vùng ảnh, không zoom cứng;
- click claim hoặc finding chip: zoom có chủ đích, có restore pill;
- auto-focus chỉ nên dùng khi run vừa hoàn tất và finding confidence đủ cao;
- nếu user đang pan/zoom thủ công, mọi auto-focus pending phải bị hủy;
- nếu một answer có nhiều finding, focus theo thứ tự từng claim chứ không nhảy camera liên tục.

### 5.3. Restore UX

Sau mọi focus tự động phải có đường quay về rõ ràng:

- pill `Quay về góc nhìn trước`;
- timeout chỉ dùng cho preview focus, không dùng cho committed review;
- nếu user pin Dock và đang review evidence, không auto-restore.

### 5.4. Multi-anchor answers

Một câu trả lời lâm sàng thường gắn nhiều vùng ảnh. Vì vậy cần support:

- `finding group` với nhiều chip;
- thứ tự ưu tiên anchor;
- breadcrumb `1/3 vùng liên quan`;
- khả năng chuyển qua lại mà không mất context của answer.

---

## 6. Rendering model cho LLM output

### 6.1. Bỏ raw paragraph làm output mặc định

Paragraph vẫn cần tồn tại như fallback, nhưng không được là chuẩn chính.

Mỗi intent nên có block profile riêng.

### Explain profile

- `summary`
- `bullet_list` hoặc `finding_group`
- `warning` nếu evidence yếu hoặc mâu thuẫn
- `evidence_digest`
- `table` nếu có so sánh hoặc differential

### Draft profile

- `summary`
- `field_patch` hoặc `patch_bundle`
- `warning` cho field thiếu bằng chứng
- `table` cho compare trước/sau nếu cần

### Knowledge profile

- `summary`
- `paragraph`
- `table` cho guideline criteria
- `metric` hoặc `key_value` block cho threshold/range
- `warning` cho freshness / source mismatch

### Block types nên bổ sung

Khuyến nghị mở rộng `RenderableBlock` với:

- `finding_group`
- `key_value`
- `metric_bar`
- `timeline`
- `patch_bundle`
- `question_block`
- `empty_state`
- `compare_panel`

Đây là khác biệt lớn giữa “AI biết nói” và “AI biết trình bày để bác sĩ quyết định nhanh”.

### 6.2. Không hiển thị chain-of-thought thô trên surface chính

`thinking` trong code hiện tại hữu ích cho debug, nhưng không phù hợp làm clinician-facing UX.

Nguyên tắc:

- surface chính chỉ hiển thị `processing steps` hoặc `tool progress` đã biên tập;
- raw reasoning, token count, provider trace nằm trong `System status` hoặc dev mode;
- không hiển thị lập luận nội bộ kéo dài cho user cuối.

### 6.3. Long answer phải có progressive disclosure

Long answer phải được chia làm các tầng:

- tầng 1: 1-2 câu summary;
- tầng 2: key points;
- tầng 3: evidence excerpts;
- tầng 4: technical detail hoặc caveat.

Nếu không chia tầng, panel sẽ lại quay về chat transcript dài dòng.

---

## 7. Draft Composer phải là AI review surface, không phải chat panel ở step Draft

### 7.1. Đơn vị review chính là field

Draft UI phải xoay quanh từng field như:

- `Findings`
- `Impression`
- `Recommendation`
- `Comparison`

Mỗi field card cần có:

- trạng thái `clean`, `suggested`, `needs review`, `conflicted`, `locked`;
- số patch đang chờ;
- evidence count;
- lần sửa gần nhất;
- source của patch: `AI`, `manual`, `merged`.

### 7.2. Patch bundle là đơn vị thao tác chính

Một run không nên ném text thay thế nguyên cục. Nó phải trả về patch bundle:

- `patch_id`
- `field_key`
- `before`
- `after`
- `rationale`
- `citations[]`
- `confidence`
- `status`

UI cần hỗ trợ:

- accept từng patch;
- reject từng patch;
- accept all in field;
- compare raw full-text trước/sau;
- xem “tại sao patch này được đề xuất”.

### 7.3. Không dùng chat làm mặt điều khiển chính của Draft

Chat chỉ dùng cho các lệnh phụ như:

- “viết ngắn hơn”
- “giữ nguyên findings nhưng siết phần impression”
- “bỏ recommendation này nếu evidence chưa đủ”

Nhưng UI trung tâm vẫn phải là patch review. Nếu không, user sẽ luôn phải đọc text dài và tự đoán thay đổi nằm ở đâu.

---

## 8. Knowledge/RAG UX không nên chỉ là kho tài liệu

Surface knowledge hiện nên được tái định nghĩa thành “evidence operations”.

Nó phải trả lời:

- corpus nào đang active cho CAE;
- guideline nào stale;
- chunk coverage cho domain nào còn yếu;
- ingestion nào lỗi hoặc chưa có embedding;
- query nào hay rơi vào no-evidence;
- document nào trùng, lệch version, hoặc không còn hiệu lực.

Vì vậy knowledge page về lâu dài nên có:

- freshness dashboard;
- duplicate/version cluster;
- evidence coverage theo topic;
- ingestion health;
- top missing evidence intents;
- audit trail cho patch provenance.

Nếu knowledge chỉ là danh sách upload/delete, RAG sẽ tiếp tục yếu dù frontend đẹp hơn.

---

## 9. Trust, policy, cache, provider UX

### 9.1. Những gì nên hiện cho bác sĩ

- nguồn bằng chứng nội bộ hay tham khảo;
- ngày hiệu lực của guideline;
- patch nào evidence yếu;
- answer nào không đủ dữ liệu;
- field nào còn unresolved.

### 9.2. Những gì không nên đặt làm primary surface

- toggle provider thủ công trên main case view;
- raw chain-of-thought;
- token accounting chi tiết;
- kỹ thuật cache key;
- trace kỹ thuật của multi-provider race.

Những thứ này thuộc `system_status`, QA mode, hoặc admin view.

### 9.3. Cache UX đúng nghĩa

Cache không chỉ là backend optimization. UX cần phản ánh:

- answer hiện tại là fresh hay reused;
- reused trong cùng case hay từ cache chung;
- khi evidence đã thay đổi, cache phải tự mất hiệu lực;
- patch cũ không được giả như patch mới.

Clinician surface không cần biết `redis hit`, nhưng cần biết `đã dùng lại kết quả phân tích trước đó` nếu điều này ảnh hưởng trust.

---

## 10. Loading, failure, degraded states

### 10.1. Streaming phải theo stage, không phải text nhỏ giọt vô hạn

Thay vì chỉ có spinner + text stream, Dock nên hiển thị progression:

1. Thu thập case context
2. Truy xuất evidence
3. Tổng hợp answer
4. Chuẩn bị patch hoặc actions

### 10.2. No-evidence không được nhìn như lỗi kỹ thuật

Phải tách rõ:

- route lỗi;
- provider timeout;
- retrieval rỗng;
- evidence yếu không đủ kết luận;
- draft patch bị chặn do confidence thấp.

Mỗi loại cần UI khác nhau. Nếu tất cả đều biến thành một paragraph đỏ, user sẽ mất trust rất nhanh.

### 10.3. Partial success phải được render rõ

Ví dụ:

- brief tạo được nhưng evidence nội bộ chưa đủ;
- patch tạo được cho `Findings` nhưng `Recommendation` bị blocked;
- explain thành công nhưng chưa có spatial anchor.

Dock phải hiển thị partial completion thay vì chỉ `done/failed` nhị phân.

---

## 11. Delta triển khai bám vào code hiện tại

### `apps/web/src/components/cae/CAEDock.tsx`

Giữ lại shell hiện tại, nhưng cần nâng cấp từ “single live stream panel” thành “task-run workspace”.

Việc cần làm:

- đưa task strip vào thay cho một màn hình chỉ hiển thị run hiện tại;
- tách `thinking` khỏi clinician surface chính;
- làm `mode` bám vào intent và run type;
- cho Dock nhận `actions[]` để tự chuyển state.

### `apps/web/src/hooks/useCAEStream.ts`

Việc cần làm:

- tiêu thụ `ui_action` event thay vì bỏ qua;
- tiêu thụ `block_content` nếu muốn block streaming mượt;
- giữ history theo run thay vì reset toàn bộ context mỗi lượt;
- emit status chuẩn cho task card.

### `apps/web/src/components/cae/EvidenceRail.tsx`

Việc cần làm:

- nhóm citation theo claim/patch;
- hỗ trợ highlight đồng bộ giữa rail, block, viewport;
- hiển thị freshness/deprecation cho source nội bộ;
- cho rail biết source nào đang active với field nào.

### `apps/web/src/lib/spatial-focus.ts`

Việc cần làm:

- nối vào case viewport thật;
- nhận action từ Dock và từ Explain/Draft panels;
- hỗ trợ hover preview khác với committed focus;
- expose restore affordance cho page.

### `apps/web/src/components/cae/BlockRenderer.tsx`

Việc cần làm:

- thêm compare, metric, question, empty, patch bundle blocks;
- thống nhất interaction giữa block và evidence rail;
- chuẩn hóa styles cho `warning` và `field_patch` để bớt giống debug card.

### `apps/web/src/app/cases/[id]/page.tsx`

Việc cần làm:

- loại mock/sample/fallback khỏi clinical surface;
- biến Dock thành orchestration layer cho Explain/Draft thay vì panel đứng trên cùng;
- đồng bộ state giữa step, viewport, dock, field composer;
- bỏ các citation popup cũ khi evidence rail đã đủ trưởng thành.

### Backend contract

Việc cần làm:

- routes `cae`, `query`, `explain`, `draft`, `detect` phải cùng đi qua block/action contract;
- detection phải trả finding anchors đủ chuẩn cho spatial focus;
- reporter phải trả patch-ready payload;
- retrieval trace phải đủ để render evidence provenance.

---

## 12. Roadmap thực dụng

### Phase A. Hợp nhất primitives đã có

- wire `UIAction` từ stream sang Dock và viewport;
- bỏ mock/fallback ở case surface;
- harden `CAEDock`, `EvidenceRail`, `BlockRenderer`, `spatial-focus`.

### Phase B. Chuyển transcript sang task-run model

- task strip;
- per-run summary;
- grouped evidence;
- per-run state and memory.

### Phase C. Chuyển Draft sang patch-review model

- field cards;
- patch bundle;
- compare and accept/reject;
- provenance per field.

### Phase D. Tách clinician UX và engineering UX

- clinician surface: summary, evidence, caveat, action;
- system surface: provider, cache, telemetry, run trace.

---

## 13. Success criteria

Thiết kế này được coi là thành công khi:

- bác sĩ không còn phải đọc transcript dài để hiểu AI muốn làm gì;
- answer nào cũng cho thấy evidence đủ rõ hoặc nói rõ là chưa đủ;
- click vào finding hoặc citation có thể đưa user tới vùng ảnh liên quan và quay về dễ dàng;
- draft review diễn ra ở cấp field/patch thay vì text blob;
- provider/debug detail không còn chen vào clinician workflow chính;
- knowledge/RAG được nhìn như nguồn bằng chứng vận hành, không chỉ là kho file.

Nếu chỉ thêm panel đẹp hơn nhưng vẫn giữ transcript, mock fallback, spatial disconnect, và draft chat-first, thì đó chưa phải redesign thật.