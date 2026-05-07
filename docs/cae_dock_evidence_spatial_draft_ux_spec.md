# UX Spec Chi Tiết Cho CAE Dock, Evidence Rail, Spatial Focus, Draft Composer

## 0. Thông tin tài liệu

| Trường | Nội dung |
| --- | --- |
| Tên tài liệu | CAE Advanced UX Spec |
| Phạm vi | Tối ưu lớp trải nghiệm AI/LLM trong case workspace và knowledge workflow |
| Liên quan | `docs/cae_integrated_ux_behavior_spec.md`, `docs/mvp_ui_ux_plan.md`, `docs/prd_ui_flow_y_te_rag.md` |
| Bề mặt hiện tại | `apps/web/src/app/cases/[id]/page.tsx`, `apps/web/src/components/cae/CAEPanel.tsx`, `apps/web/src/app/knowledge/page.tsx` |
| Trạng thái | Draft để chốt thiết kế sản phẩm và chia backlog triển khai |

---

## 1. Mục tiêu

Tài liệu này mở rộng blueprint CAE tích hợp đã có, tập trung riêng vào bốn bề mặt UX quyết định chất lượng trải nghiệm AI/LLM:

1. `CAE Dock` — lớp tương tác AI trượt, co giãn, và đổi vai theo bước làm việc.
2. `Evidence Rail` — lớp hiển thị bằng chứng, nguồn, mức tin cậy, và provenance bám theo từng câu trả lời.
3. `Spatial Focus` — cơ chế liên kết câu trả lời AI với đúng vùng tổn thương trên ảnh bằng pan, zoom, pulse, và restore camera state.
4. `Draft Composer` — màn biên tập báo cáo theo field và patch, thay thế mô hình chat sửa text kéo dài.

Mục tiêu của spec không phải là làm giao diện "ngầu hơn". Mục tiêu là giảm tải nhận thức, tăng tốc độ đọc phim và duyệt báo cáo, và làm cho AI trở thành lớp hỗ trợ có kiểm soát thay vì một panel text cạnh tranh với nội dung chính.

---

## 2. Chẩn đoán UX hiện tại

### 2.1. Vấn đề cấu trúc

- CAE đang là một panel cố định nằm ở đầu cột thao tác trong case page, khiến nó cạnh tranh trực tiếp với Detection, Explain, Draft thay vì hỗ trợ chúng.
- Tỷ lệ ảnh và text hiện dựa nhiều vào lựa chọn tay của người dùng (`wide`, `balanced`, `compact`), tức là hệ thống bắt người dùng tự giải quyết chỗ đứng của AI.
- Explain, query, draft và CAE brief đều đang có logic riêng, hiển thị riêng, không tạo cảm giác đây là một lớp intelligence thống nhất của case.

### 2.2. Vấn đề về output AI

- Output hiện tại là text tuyến tính, rất dễ thành khối dài thòng lòng khi model stream hoặc trả lời dài.
- Chat lịch sử được render như transcript, thiếu cơ chế nhóm theo task, nhóm theo câu hỏi, hoặc thu gọn theo summary.
- Hệ thống chưa có block renderer chuẩn cho bảng, checklist, timeline, chart, diff, warning, hay evidence card.
- Output hiện vẫn lộ những dấu vết chưa chuyên nghiệp cho môi trường lâm sàng như emoji, marker tạm, wording debug, hoặc tool trace quá thô.

### 2.3. Vấn đề về liên kết không gian

- Khi AI nói tới vùng bệnh, người dùng vẫn phải tự dò trên phim.
- Popup nguồn hiện tách biệt khỏi ảnh nên không tạo được cảm giác bằng chứng đang neo vào đúng vùng tổn thương.
- Không có camera state memory để auto-zoom rồi trả ảnh về góc nhìn trước đó một cách tin cậy.

### 2.4. Vấn đề về draft workflow

- Draft hiện vẫn thiên về kiểu chat sửa tự do, không tối ưu cho tác vụ biên tập có cấu trúc.
- Bác sĩ cần thấy field nào do AI sinh, field nào bị khóa, patch nào đang chờ duyệt, patch nào đã được chấp nhận, nhưng UI hiện chưa đặt điều đó ở trung tâm.
- Tương tác approve or reject patch chưa thành workflow chính.

### 2.5. Vấn đề về trust surface

- Provider, nguồn, confidence, fallback, cache hit, retrieval quality chưa được tổ chức thành một trust layer rõ ràng.
- Người dùng cần biết AI nói dựa trên gì, nội bộ hay tham khảo, mới hay cũ, có fallback hay không, nhưng UI hiện chủ yếu chỉ hiện kết quả text.

---

## 3. Nguyên tắc thiết kế

### 3.1. Image-first, evidence-first, action-second

Trong case workspace, ảnh và field báo cáo là vật thể chính. AI không phải vật thể chính. AI chỉ được phép mở rộng, thu gọn, và chen vào UI khi nó làm cho ảnh hoặc field trở nên dễ hiểu và dễ duyệt hơn.

### 3.2. Summary trước, chi tiết sau

Mọi output AI phải đi theo chiến lược:

- mặc định chỉ hiện summary ngắn;
- bằng chứng và patch là lớp thứ hai;
- transcript, raw reasoning, tool trace, provider diagnostics là lớp thứ ba;
- lớp thứ ba không bao giờ chiếm sân khấu mặc định.

### 3.3. Spatial truthfulness

Nếu AI nhắc tới một finding, một sentence, hoặc một citation có neo không gian, UI phải có cách đưa người dùng tới đúng vùng trên ảnh và trả lại góc nhìn ban đầu khi kết thúc.

### 3.4. Field-centric editing

Ở bước Draft, đơn vị tương tác chính không phải là tin nhắn chat mà là `field`, `patch`, `source`, và `decision`.

### 3.5. Calm AI

AI phải ít nói, rõ, có chọn lọc. UI không được khuyến khích model nói nhiều chỉ để tạo cảm giác thông minh.

### 3.6. Professional clinical tone

Output cuối dành cho bác sĩ không dùng emoji, không dùng giọng marketing, không dùng badge màu mè không có nghĩa nghiệp vụ.

---

## 4. Kiến trúc trải nghiệm cấp cao

### 4.1. Mô hình workspace

Case workspace mới gồm bốn lớp:

1. `Clinical Canvas` — ảnh X-quang, overlays, bbox, contextual metadata.
2. `Task Surface` — Detection, Explain, Draft theo bước làm việc.
3. `CAE Dock` — lớp AI có thể trượt, co lại, hoặc mở lớn tùy trạng thái.
4. `Evidence Rail` — lớp bằng chứng cố định hoặc bán cố định, neo theo output đang được đọc.

### 4.2. Mối quan hệ giữa các lớp

- `CAE Dock` điều phối tương tác AI.
- `Evidence Rail` neo bằng chứng vào text và ảnh.
- `Spatial Focus` là hành vi, không phải component riêng; nó được kích hoạt bởi Dock hoặc Rail.
- `Draft Composer` là mode chuyên biệt của Task Surface nhưng nhận patch từ CAE Dock.

---

## 5. CAE Dock

### 5.1. Mục đích

Thay thế panel AI cố định bằng một dock thích nghi theo bối cảnh làm việc của bác sĩ.

Dock phải:

- tự thu nhỏ khi người dùng đang tập trung vào ảnh hoặc field;
- tự mở khi có insight thật sự quan trọng;
- chuyển vai linh hoạt giữa Brief, Evidence QA, Patch Review, và System Status;
- giữ cảm giác CAE là một lớp hỗ trợ bám theo case, không phải một tab hay một cửa sổ chat riêng.

### 5.2. Vị trí

- Mặc định neo cạnh phải của workspace.
- Trên màn hình rộng, dock trượt vào cột thao tác nhưng không được khóa chiều cao toàn bộ.
- Trên màn hình hẹp hơn, dock có thể trở thành bottom sheet với cùng state machine.

### 5.3. State machine

Dock có 6 state chính:

| State | Mục đích | Kích thước | Khi nào dùng |
| --- | --- | --- | --- |
| `collapsed` | Giảm nhiễu tối đa | 40-56 px | Người dùng đang đọc ảnh hoặc chỉnh field |
| `peek` | Hiện 1 insight hoặc cảnh báo ngắn | 88-120 px | Có tín hiệu mới nhưng chưa cần chiếm chỗ |
| `task` | Tương tác AI mức vừa | 320-420 px | Brief, hỏi đáp ngắn, tool status |
| `focus` | Liên kết chặt với bằng chứng hoặc spatial focus | 420-520 px | Khi AI đang dẫn người dùng tới vùng bệnh hoặc citation |
| `compose` | Làm việc sâu với patch report | 480-640 px | Ở bước Draft |
| `pinned` | Người dùng chủ động giữ dock mở | Theo state trước đó | Khi user ghim để làm việc lâu |

### 5.4. Quy tắc chuyển state

- `collapsed -> peek`: khi có brief mới, warning mới, hoặc patch mới.
- `peek -> task`: khi user hover lâu, click vào insight, hoặc dùng phím tắt mở dock.
- `task -> focus`: khi câu trả lời AI kích hoạt `Spatial Focus` hoặc khi user mở evidence rail chi tiết.
- `task -> compose`: khi chuyển sang step Draft và có patch pending.
- `task/focus/compose -> peek`: sau khi action tự động hoàn tất và user không tương tác trong khoảng thời gian định sẵn.
- `any -> pinned`: khi user bấm pin.
- `pinned` chỉ thoát khi user unpin.

### 5.5. Hành vi tự động

Dock được phép tự mở chỉ trong các trường hợp:

- case vừa mở và đủ dữ liệu để tạo brief;
- có xung đột mạnh giữa phim, lâm sàng, và tri thức;
- có patch báo cáo cần bác sĩ duyệt;
- có lỗi hệ thống ảnh hưởng trực tiếp tới tính tin cậy của output;
- AI vừa xác định vùng tổn thương quan trọng cần dẫn hướng trên ảnh.

Dock không được tự bật lớn khi:

- user đang pan or zoom bằng chuột hoặc touchpad;
- user đang nhập text trong field báo cáo;
- user đang đọc citation hoặc đang pin evidence rail;
- không có dữ liệu mới so với brief gần nhất.

### 5.6. Cấu trúc bên trong Dock

Dock có 5 vùng nội dung:

1. `Dock Handle` — tay nắm, badge trạng thái, pin, expand, close.
2. `Mode Header` — đang ở Brief, Ask, Patch Review, hay System State.
3. `Summary Strip` — câu ngắn nhất mà user cần thấy đầu tiên.
4. `Action Zone` — input, prompt chips, quick actions, patch accept or reject.
5. `Details Drawer` — expandable content cho evidence, reasoning, tool trace, diagnostics.

### 5.7. Cách hiển thị output trong Dock

Dock không render transcript thô làm mặc định. Thay vào đó dùng `answer blocks`:

- `summary`
- `bullet_list`
- `warning`
- `evidence_digest`
- `table`
- `field_patch`
- `system_state`

Các block phải có thể thu gọn. Summary luôn nằm trên cùng. Table và field patch có interaction riêng, không bị ép thành plain paragraph.

### 5.8. Chat UX bên trong Dock

Chat không còn là log vô hạn. Mỗi lượt hỏi được render thành `task card`:

- câu hỏi người dùng;
- summary trả lời;
- số lượng nguồn;
- confidence level;
- nút mở chi tiết;
- trạng thái provider nếu thật sự cần;
- trạng thái draft patch nếu câu hỏi tạo patch.

Khi model trả lời dài, Dock phải:

- stream theo câu hoặc đoạn, không stream từng token ra UI;
- auto-collapse phần chi tiết;
- giữ chỉ 1-2 câu summary ở mặt card;
- cho phép user ghim card quan trọng.

### 5.9. Prompt chips

Prompt chips nên là hành động ngắn gắn với step, ví dụ:

- Detection: `Điểm cần chú ý`, `Điểm dễ bỏ sót`, `Mức độ tin cậy của vùng này`.
- Explain: `Tóm tắt bằng chứng`, `Có xung đột gì không`, `Nguồn nội bộ đang ưu tiên gì`.
- Draft: `Rà soát impression`, `Kiểm tra recommendation`, `Field nào cần bác sĩ xác nhận`.

Chip không được là gợi ý chung chung theo kiểu chatbot.

### 5.10. Provider và system status trong Dock

Trạng thái provider được hạ xuống lớp phụ:

- user lâm sàng chỉ thấy `CAE sẵn sàng`, `CAE suy giảm`, `CAE đang dùng provider dự phòng`;
- chế độ debug hoặc ops mới thấy provider cụ thể, latency, cache hit, retrieval source mix.

### 5.11. Accessibility

- `Escape` thu dock về state trước đó nếu không pinned.
- `Ctrl/Cmd + .` mở dock.
- focus trap chỉ bật khi dock ở `compose` hoặc `focus` với drawer đang mở.
- dock handle phải dùng được bằng bàn phím và screen reader.

---

## 6. Evidence Rail

### 6.1. Mục đích

Evidence Rail là lớp hiển thị bằng chứng cố định hoặc bán cố định, để người dùng không phải mở popup nổi rồi đóng liên tục.

Rail phải giúp trả lời bốn câu hỏi:

1. CAE đang nói dựa trên nguồn nào?
2. Nguồn đó là nội bộ hay tham khảo?
3. Đoạn nào trong tài liệu đang được dùng?
4. Đoạn đó có neo vào finding hoặc field nào không?

### 6.2. Vị trí

- Trên desktop rộng, rail nằm giữa `Task Surface` và `CAE Dock` hoặc nằm trong một cột phụ kế bên task.
- Trên màn hình hẹp, rail trở thành tab phụ trong Dock nhưng vẫn phải giữ semantics riêng.

### 6.3. Cấu trúc rail

Rail gồm các lớp:

1. `Context Header` — đang xem evidence cho câu nào, field nào, hoặc finding nào.
2. `Source Stack` — danh sách citation cards theo mức độ liên quan.
3. `Source Filters` — `Nội bộ`, `Tham khảo`, `Cả hai`, `Mới nhất`, `Độ tin cậy cao`.
4. `Excerpt Viewer` — đoạn trích highlight phần đang được dùng.
5. `Trust Footer` — similarity, freshness, provider, fallback, cache, retrieval notes.

### 6.4. Citation card

Mỗi citation card phải hiển thị:

- tên tài liệu;
- loại nguồn: `Nội bộ` hoặc `Tham khảo`;
- phiên bản và ngày hiệu lực;
- excerpt đã cắt gọn;
- độ liên quan;
- liên kết tới section hoặc khu vực logic đang được trích;
- nếu có neo hình ảnh thì có badge `Gắn với vùng ảnh`.

### 6.5. Hành vi tương tác

- hover câu trong summary thì rail highlight source tương ứng;
- hover source trong rail thì ảnh sáng hoặc zoom đúng finding nếu có anchor;
- click source thì mở excerpt viewer và highlight phần được trích;
- click lại thì trả ảnh về trạng thái trước focus nếu đang ở spatial mode.

### 6.6. Quy tắc sắp xếp nguồn

Source Stack mặc định sắp theo thứ tự:

1. nội bộ hospital policy phù hợp;
2. nội bộ guideline hoặc SOP cùng specialty;
3. tham khảo ngoài có freshness cao;
4. các nguồn bổ sung, độ tin cậy thấp hơn.

Nếu nội bộ và tham khảo xung đột, rail phải có `conflict banner` riêng, không để AI tự làm phẳng khác biệt.

### 6.7. Empty, degraded, conflict states

- `empty`: không có nguồn đủ tin cậy.
- `degraded`: CAE trả lời được nhưng retrieval hoặc provider có suy giảm.
- `conflict`: nguồn nội bộ và tham khảo đang khác hướng.
- `fallback`: câu trả lời dùng provider dự phòng hoặc retrieval fallback.

### 6.8. Accessibility

- mọi card nguồn phải có heading và text đọc được bởi screen reader;
- similarity bar không được là kênh duy nhất để diễn giải confidence;
- excerpt highlight phải có cách điều hướng bằng bàn phím.

---

## 7. Spatial Focus

### 7.1. Mục đích

Spatial Focus là hành vi liên kết AI text với đúng vùng trên phim. Đây là phần tạo khác biệt sản phẩm rõ nhất: khi AI nhắc tới vùng bệnh, UI phải đưa user tới vùng đó rồi trả ảnh về trạng thái trước đó một cách an toàn.

### 7.2. Nguyên tắc

- auto-focus chỉ là hỗ trợ, không cướp quyền điều khiển;
- user luôn có thể hủy focus bằng thao tác pan or zoom thủ công;
- mọi auto-focus phải có `restore path` rõ ràng;
- nhiều focus liên tiếp phải quản lý bằng stack, không zoom đè bừa lên nhau.

### 7.3. Dữ liệu cần có

Spatial Focus cần `finding anchors` có cấu trúc, ví dụ:

```ts
type FindingAnchor = {
  findingId: string;
  imageId: string;
  bbox: [number, number, number, number];
  label: string;
  confidence: number;
};

type UIAction =
  | { type: 'focus_finding'; findingId: string; zoom?: number; ttlMs?: number }
  | { type: 'restore_view'; target?: 'previous' | 'default' }
  | { type: 'open_evidence'; citationId: string }
  | { type: 'dock_state'; state: 'peek' | 'task' | 'focus' | 'compose' };
```

### 7.4. Camera memory stack

Image viewer phải lưu được:

- camera center;
- zoom level;
- pan offsets;
- focused finding hiện tại;
- origin state trước auto-focus.

Khi auto-focus chạy:

1. push current camera state vào stack;
2. pan and zoom tới finding;
3. pulse bbox hoặc glow nhẹ;
4. hiện micro-label giải thích lý do focus;
5. hết TTL hoặc user dismiss thì pop state và restore.

### 7.5. Trigger hierarchy

Thứ tự ưu tiên trigger:

1. click finding của người dùng;
2. click citation có anchor;
3. click patch liên quan một finding;
4. auto-focus từ AI summary;
5. auto-focus từ background system event.

Trigger ưu tiên thấp hơn không được cướp focus của trigger cao hơn.

### 7.6. Restore rules

- nếu auto-focus do system tạo và user không chạm ảnh, restore theo TTL;
- nếu user tương tác trong lúc focus, coi camera mới là user-owned state, không auto-restore đè lên;
- nếu nhiều focus được xếp stack liên tiếp, restore theo LIFO.

### 7.7. UI feedback khi focus

Khi focus vào vùng bệnh, UI phải:

- zoom and pan mượt trong khoảng 180-280 ms;
- pulse bbox 1-2 lần;
- hiện label ngắn như `CAE đang chỉ vùng đông đặc thùy dưới phải`;
- nếu rail đang mở, source liên quan cũng được highlight đồng thời.

### 7.8. Safety rules

- không auto-zoom nếu finding confidence dưới ngưỡng cấu hình trừ khi user chủ động yêu cầu;
- không auto-focus liên tục nhiều hơn một lần trong cửa sổ thời gian ngắn;
- không tự focus vào vùng không có anchor hình học đáng tin cậy.

### 7.9. Fullscreen mode

Spatial Focus phải hoạt động cả ở chế độ fullscreen. Khi fullscreen đang mở, focus event chỉ đổi camera trong fullscreen viewer, không được kéo user về layout thường.

---

## 8. Draft Composer

### 8.1. Mục đích

Draft Composer thay mô hình `chat sửa báo cáo` bằng `biên tập có cấu trúc theo field và patch`.

### 8.2. Bài toán UX cần giải

- bác sĩ phải thấy field nào do AI sinh;
- patch nào đang chờ duyệt;
- patch nào dựa trên nguồn nào;
- field nào đã bị bác sĩ sửa và không nên bị AI đề xuất lặp lại;
- recommendation, impression, severity phải có trust UI mạnh hơn các field phụ.

### 8.3. Layout tổng thể

Draft Composer gồm 3 vùng:

1. `Field Column` — danh sách field báo cáo có trạng thái rõ ràng.
2. `Patch Tray` — patch do CAE đề xuất, xếp theo mức độ quan trọng.
3. `Evidence Sidebar` — bằng chứng cho patch đang chọn.

Chat chỉ còn là vùng phụ để yêu cầu patch mới hoặc hỏi giải thích, không còn là tương tác trung tâm.

### 8.4. Field card

Mỗi field card hiển thị:

- label field;
- trạng thái: `AI-generated`, `needs review`, `manual`, `locked`, `accepted`, `rejected`, `edited by clinician`;
- nội dung hiện tại;
- provenance chips;
- icon cho mức độ rủi ro;
- CTA: `Xem patch`, `Khóa`, `Mở khóa`, `So sánh`, `Hoàn tác`.

### 8.5. Patch model

Patch phải là object có cấu trúc:

```ts
type FieldPatch = {
  patchId: string;
  fieldId: string;
  patchType: 'replace' | 'append' | 'shorten' | 'clarify' | 'remove' | 'fill_missing';
  summary: string;
  rationale: string;
  confidence: number;
  citations: string[];
  basedOnFindings?: string[];
  basedOnClinicalData?: string[];
  diff: {
    before: string;
    after: string;
  };
};
```

### 8.6. Patch tray behavior

- patch tray sắp theo mức ảnh hưởng lâm sàng và completeness;
- patch có severity cao nổi lên đầu;
- patch đã bị reject được lưu nhưng thu gọn, để tránh AI lặp đề xuất giống hệt;
- patch được chọn sẽ đồng thời highlight field card và evidence tương ứng.

### 8.7. Review workflow

Mỗi patch phải có các nút:

- `Accept`
- `Reject`
- `Edit before accept`
- `Ask CAE why`
- `Lock field`

Nếu user `Edit before accept`, patch chuyển sang trạng thái `clinician-modified acceptance`, và history phải ghi rõ đây không còn là nguyên patch AI.

### 8.8. Structured output support

Draft Composer phải render được các dạng output sau:

- narrative paragraph;
- bullet list;
- clinical checklist;
- evidence table;
- mini trend chart cho chỉ số lâm sàng theo thời gian;
- before/after diff;
- missing data checklist.

Không ép tất cả thành paragraph đơn.

### 8.9. Memory trong Draft Composer

Composer phải đọc được `working set` của case:

- finding nào bác sĩ đã reject;
- field nào bác sĩ đã sửa tay;
- patch nào đã bị từ chối;
- source nào user đang tin hoặc không tin;
- step explain trước đó có conflict gì chưa được xử lý.

### 8.10. Professional rendering rules

- không emoji trong report-facing content;
- dùng sentence case;
- không để model tự render pseudo-table bằng dấu `|` nếu frontend đã hỗ trợ table blocks;
- warning phải dùng component cảnh báo chuẩn, không dùng marker text ngẫu nhiên.

### 8.11. Accessibility

- diff view phải đọc được bằng screen reader;
- patch action phải keyboard-friendly;
- field đang active có focus ring và label rõ.

---

## 9. Shared structured response contract

### 9.1. Mục tiêu

Muốn có Dock, Rail, Spatial Focus, Draft Composer tốt thì backend không thể tiếp tục trả text tự do là đủ. Cần một hợp đồng tối thiểu giữa AI layer và UI layer.

### 9.2. Renderable blocks

```ts
type RenderableBlock =
  | { type: 'summary'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullet_list'; items: string[] }
  | { type: 'warning'; severity: 'info' | 'caution' | 'high'; text: string }
  | { type: 'table'; columns: string[]; rows: string[][] }
  | { type: 'trend'; title: string; points: Array<{ x: string; y: number; label?: string }> }
  | { type: 'field_patch'; patchId: string }
  | { type: 'system_state'; label: string; detail?: string };
```

### 9.3. Citation anchors

```ts
type CitationAnchor = {
  citationId: string;
  blockIndex: number;
  sentenceRange?: [number, number];
  findingIds?: string[];
  trustLevel: 'internal' | 'reference';
};
```

### 9.4. UI actions

```ts
type CAEUIAction =
  | { type: 'dock_state'; state: 'peek' | 'task' | 'focus' | 'compose' }
  | { type: 'focus_finding'; findingId: string; zoom?: number; ttlMs?: number }
  | { type: 'highlight_field'; fieldId: string }
  | { type: 'open_evidence'; citationId: string }
  | { type: 'restore_view'; target?: 'previous' | 'default' };
```

### 9.5. Degraded contract fallback

Nếu backend chưa trả block cấu trúc, frontend được phép dùng text fallback nhưng phải:

- render vào `paragraph` block duy nhất;
- tắt các tính năng yêu cầu anchor;
- hiện badge `Đầu ra chưa có cấu trúc đầy đủ` ở chế độ debug nội bộ, không hiện cho người dùng cuối.

---

## 10. Trạng thái tải, lỗi, suy giảm

### 10.1. Loading

- Dock loading dùng skeleton theo block, không dùng spinner trần kéo dài.
- Rail loading dùng source card skeleton.
- Draft patch loading phải có placeholder ở đúng field đang liên quan.

### 10.2. Error

- nếu query AI thất bại, UI phải nói rõ `không truy xuất được kết quả từ CAE`, không được silently rơi về mock;
- nếu retrieval thất bại nhưng provider còn hoạt động, rail phải báo degraded;
- nếu provider fallback xảy ra, user chỉ cần biết ảnh hưởng: chậm hơn, ít evidence hơn, hoặc bằng chứng không đổi.

### 10.3. No evidence

- không render text chung chung;
- phải có card `Không đủ bằng chứng` với các gợi ý tiếp theo như: đổi câu hỏi, lọc theo nguồn nội bộ, kiểm tra lại metadata tài liệu.

---

## 11. Analytics và telemetry bắt buộc

### 11.1. Dock

- số lần auto-open;
- số lần user pin hoặc unpin;
- thời gian dock mở trung bình theo step;
- số lần user dismiss ngay sau auto-open.

### 11.2. Evidence Rail

- citation click-through rate;
- số lần mở rail;
- số lần user filter `Nội bộ` vs `Tham khảo`;
- top cited documents;
- no-evidence query rate.

### 11.3. Spatial Focus

- số lần focus finding thành công;
- số lần user interrupt auto-focus;
- time to first anchored evidence;
- focus-to-restore success rate.

### 11.4. Draft Composer

- patch acceptance rate;
- patch rejection rate;
- edit-before-accept rate;
- field-level edit distance giữa AI và final;
- tỷ lệ field bị lock bởi bác sĩ.

---

## 12. Success criteria

Thiết kế mới được coi là thành công khi thỏa các tiêu chí sau trong pilot nội bộ:

1. Người dùng không còn phải đọc transcript dài để lấy ý chính.
2. Time to first relevant evidence giảm rõ so với popup citation hiện tại.
3. Người dùng có thể đi từ câu AI tới đúng vùng ảnh trong tối đa 1-2 thao tác.
4. Draft review chuyển sang mô hình field and patch, không còn phụ thuộc vào chat dài.
5. Dock tự mở đúng lúc và tự thu hợp lý, không tạo cảm giác hệ thống giành chỗ với người dùng.
6. Output cuối không còn emoji, pseudo-table thô, hay wording debug trên surface lâm sàng.

---

## 13. Phụ lục: quyết định sản phẩm quan trọng

### 13.1. Những gì không nên làm

- không biến Dock thành một chatbot sidebar generic;
- không để reasoning thô chiếm diện tích mặc định;
- không để AI tự ý zoom ảnh mà không có restore path;
- không để provider toggle thành control mặc định của bác sĩ;
- không giữ chat là hình thức trung tâm của Draft.

### 13.2. Những gì nên làm trước

- chuẩn hóa structured output contract;
- dựng Dock state machine;
- dựng Evidence Rail cố định;
- dựng Spatial Focus controller với camera memory stack;
- dựng Draft Composer theo field and patch.
