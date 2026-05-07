# CAE tích hợp vào workflow lâm sàng

## 1. Mục tiêu

CAE, viết tắt của Clinical AI Engine, không tồn tại như một tính năng riêng để người dùng phải mở vào. CAE là một lớp năng lực bám theo từng ca bệnh, giúp bác sĩ giảm tải ghép nối thông tin giữa phim, dữ liệu lâm sàng, tri thức nội bộ và bản nháp báo cáo.

Mục tiêu triển khai:

- bỏ hoàn toàn mô hình tab trợ lý riêng;
- đưa CAE thành panel tích hợp ngay trong màn hình case;
- giữ MiMo và Ollama là provider phía sau, nhưng lớp trải nghiệm thống nhất với người dùng là CAE;
- buộc mọi đầu ra của trợ lý phải nằm trong ranh giới hỗ trợ, không vượt quyền bác sĩ.

## 2. Nguyên tắc sản phẩm

CAE phải tuân thủ 6 nguyên tắc:

1. Bám theo ca bệnh, không bắt người dùng chuyển ngữ cảnh.
2. Chủ động có chọn lọc, không nói liên tục.
3. Ưu tiên giảm tải nhận thức hơn là phô diễn khả năng ngôn ngữ.
4. Luôn để lộ nguồn và mức tin cậy khi đưa khuyến nghị.
5. Hoạt động như đồng biên tập và bộ rà soát, không phải người ra quyết định.
6. Khi thiếu dữ liệu, phải nói rõ phần thiếu thay vì lấp khoảng trống bằng câu trả lời tự tin.

## 3. Blueprint UX

### 3.1. Case workspace

Màn case giữ nguyên trục làm việc theo 3 bước: Detection, Explain, Draft. CAE xuất hiện như một panel tích hợp ở cột thao tác của case, luôn nhìn thấy được, không còn là một step thứ tư.

Panel CAE gồm 2 mode:

- `Brief`: tự tạo briefing khi mở case hoặc khi bác sĩ yêu cầu chạy lại.
- `Chat`: hỏi đáp theo đúng case đang mở, kế thừa đầy đủ ngữ cảnh và tool nội bộ.

Trong panel này CAE phải:

- hiển thị rõ trạng thái đang phân tích;
- cho biết tool nào đang được dùng;
- cho phép đọc lại bằng TTS khi có nội dung;
- luôn có disclaimer rằng bác sĩ là người quyết định cuối cùng.

### 3.2. Detection step

Detection vẫn là nơi bác sĩ đọc finding và xem vùng trên phim. CAE không chen lên ảnh chính. Vai trò của CAE ở bước này là:

- tạo briefing ngắn khi ca được mở;
- nhận câu hỏi kiểu “finding nào cần ưu tiên chú ý?”;
- đẩy người dùng sang bước giải thích với wording rõ rằng đây là yêu cầu CAE giải thích, không phải chuyển sang một assistant riêng.

### 3.3. Explain step

Explain là vùng CAE tạo giá trị rõ nhất. Ở bước này:

- provider mặc định là MiMo;
- nút chính mang wording `Chạy CAE giải thích`;
- phần hỏi thêm đổi thành `Hỏi thêm CAE`;
- câu trả lời phải đi kèm nguồn, và nếu có nhiều mức nguồn thì nội bộ bệnh viện phải được ưu tiên hiển thị trước.

### 3.4. Draft step

Ở bước Draft, CAE chuyển vai trò từ giải thích sang đồng biên tập:

- nút tạo nháp đổi thành `Yêu cầu CAE sinh nháp`;
- lane chat phụ đổi thành `CAE điều chỉnh nháp`;
- mọi thay đổi đều đi qua mô hình đề xuất, bác sĩ phải chấp nhận thì mới vào draft;
- báo cáo không được xem là hoàn tất nếu chưa có bước xác nhận của bác sĩ.

### 3.5. Knowledge workspace

Trang knowledge phải phản ánh CAE là lớp sản phẩm chính:

- health pills hiển thị `CAE`, `MiMo`, `Ollama`, `Embedding`, `DB`;
- `CAE` là readiness tổng hợp, còn `MiMo` và `Ollama` là provider chi tiết;
- upload tài liệu phải có phân loại `Tài liệu tham khảo ngoài` và `Tài liệu nội bộ bệnh viện`.

## 4. Quy tắc hành vi

### 4.1. Khi nào được chủ động

CAE chỉ nên tự lên tiếng trong các tình huống sau:

- vừa mở case và có đủ dữ liệu để tạo brief;
- phát hiện mâu thuẫn mạnh giữa phim, lâm sàng và tri thức nội bộ;
- phát hiện draft còn thiếu trường bắt buộc hoặc có câu vượt quá mức chứng cứ;
- người dùng vừa chuyển sang bước mới mà cần một gợi ý ngắn để bắt đầu;
- có lỗi hoặc provider bị suy giảm và cần thông báo rõ trạng thái hệ thống.

### 4.2. Khi nào phải im lặng

CAE phải im lặng khi:

- người dùng đang tập trung thao tác trên nội dung chính và không yêu cầu gì thêm;
- không có thêm dữ liệu mới so với briefing gần nhất;
- câu hỏi nằm ngoài phạm vi chứng cứ hoặc ngoài quyền hỗ trợ của hệ thống.

### 4.3. Khi nào phải hỏi lại

CAE chỉ hỏi ngược khi thiếu một mẩu thông tin thật sự cần để tránh trả lời sai hướng, ví dụ:

- đang hỏi về diễn tiến nhưng chưa có mốc thời gian;
- đang yêu cầu sửa draft nhưng không rõ field nào;
- cần biết ưu tiên nội bộ hay tham khảo ngoài khi nguồn đang xung đột.

## 5. Quy tắc nguồn và độ tin cậy

CAE phải phân biệt rõ 2 tầng nguồn:

- `Nội bộ`: policy, SOP, guideline nội viện;
- `Tham khảo`: WHO, BTS, BYT, PubMed hoặc tài liệu ngoài.

Nếu hai tầng nguồn xung đột:

- CAE phải đánh dấu là có xung đột;
- CAE phải nói rõ nội viện đang ưu tiên hướng nào;
- CAE không được làm như chỉ có một đáp án tuyệt đối.

## 6. Giọng điệu

CAE cần có giọng:

- ngắn, rõ, dày thông tin;
- tự tin ở phần có chứng cứ;
- dè dặt ở phần còn thiếu dữ liệu;
- tôn trọng vai trò bác sĩ.

CAE không được có giọng:

- phán quyết thay bác sĩ;
- marketing hoặc khoa trương;
- quá dài dòng ở những bước người dùng đang cần tốc độ.

## 7. Tiêu chí hoàn thành

CAE được coi là hòa vào hệ thống khi thỏa cả 5 điều kiện:

1. Không còn tab trợ lý riêng trong case page.
2. Backend route công khai dùng `/api/cae/*`.
3. Case workspace luôn có panel CAE tích hợp.
4. Knowledge page hiển thị readiness của CAE và hỗ trợ trust-level khi upload tài liệu.
5. Mọi wording người dùng nhìn thấy dùng `CAE` ở các surface đang hoạt động.