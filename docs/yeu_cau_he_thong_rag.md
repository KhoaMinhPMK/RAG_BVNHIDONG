# Yêu cầu hệ thống RAG hỗ trợ tri thức nội bộ lâm sàng

## 1. Mục đích tài liệu

Tài liệu này mô tả các yêu cầu nghiệp vụ, kỹ thuật, an toàn, đánh giá và quản trị đối với hệ thống RAG phục vụ hỗ trợ tri thức nội bộ trong bài toán viêm phổi Nhi khoa. Mục tiêu là chuyển hóa các định hướng trong đề cương nghiên cứu và các nguyên tắc minh bạch, khả dụng và an toàn của TRIPOD+AI thành một bộ yêu cầu có thể dùng trực tiếp cho thiết kế hệ thống, lập backlog triển khai, xây hồ sơ kỹ thuật hoặc chuẩn bị nghiên cứu đánh giá.

## 2. Căn cứ xây dựng

- Đề cương tổng hợp nghiên cứu và triển khai kỹ thuật trong `note/de_cuong_nghien_cuu.md`.
- Nguyên tắc về intended use, care pathway, fairness, open science, usability, protocol, registration, data sharing và code sharing trong `tripodAI.md`.
- Nguyên tắc nội bộ của đề cương: LLM không là mô hình chẩn đoán nguyên phát; mọi đầu ra quan trọng phải có bằng chứng, kiểm soát nguồn và human-in-the-loop.

## 3. Định nghĩa và tuyên bố intended use

### 3.1. Vai trò của hệ thống

Hệ thống RAG là mô-đun hỗ trợ truy vấn và tổng hợp tri thức nội bộ đã được phê duyệt, dùng để:

- chuẩn hóa và giải thích ngữ cảnh chuyên môn;
- hỗ trợ tra cứu guideline, SOP, protocol và tài liệu nội bộ;
- hỗ trợ sinh nháp giải thích hoặc nháp báo cáo dựa trên bằng chứng đã được truy hồi.

Hệ thống không được xem là công cụ chẩn đoán nguyên phát, không thay thế bác sỹ điều trị hoặc bác sỹ chẩn đoán hình ảnh, và không được phép tạo quyết định điều trị tự động.

### 3.2. Người dùng đích

- Bác sỹ Nhi khoa.
- Bác sỹ chẩn đoán hình ảnh.
- Nhóm nghiên cứu lâm sàng và AI.
- Kỹ sư y sinh, CNTT y tế và bộ phận quản trị chất lượng.

### 3.3. Vị trí trong care pathway

Hệ thống chỉ được sử dụng ở các bước hỗ trợ tra cứu tri thức, giải thích kết quả mô hình, chuẩn bị hội chẩn và chuẩn bị nháp tài liệu trong luồng khám chữa bệnh hoặc nghiên cứu. Hệ thống không được đặt ở vị trí ra quyết định cuối cùng đối với chẩn đoán, nhập viện, kê đơn, y lệnh hay can thiệp điều trị.

## 4. Phạm vi và ngoài phạm vi

### 4.1. Phạm vi bao gồm

- Truy vấn tri thức nội bộ từ tài liệu đã được phê duyệt.
- Trả lời có trích dẫn nguồn và phiên bản tài liệu.
- Tóm tắt và chuẩn hóa văn bản lâm sàng trong phạm vi được cấp quyền.
- Hỗ trợ giải thích dựa trên evidence payload từ pipeline dự báo nguyên phát.
- Hỗ trợ sinh nháp báo cáo hoặc nháp hội chẩn để bác sỹ rà soát.
- Ghi log truy vấn, truy vết nguồn, phân quyền truy cập và giám sát vận hành.

### 4.2. Ngoài phạm vi ở pha nền

- Tự động chẩn đoán viêm phổi không có mô hình nguyên phát hoặc không có bằng chứng tương ứng.
- Tự động kê đơn, sinh y lệnh hoặc khuyến nghị điều trị bắt buộc.
- Trả lời dựa trên nguồn internet mở không qua quy trình phê duyệt nội bộ.
- Tự động cập nhật kho tri thức vào môi trường vận hành mà không có kiểm soát phiên bản và phê duyệt.

## 5. Nguồn tri thức được phép dùng

Kho tri thức RAG chỉ được phép chứa các tài liệu thuộc một trong các nhóm sau:

- guideline chuyên môn đã được phê duyệt;
- SOP nội bộ;
- protocol nghiên cứu;
- biểu mẫu, sổ tay gán nhãn, data dictionary, quy trình kỹ thuật nội bộ;
- tài liệu quản trị chất lượng, tài liệu đào tạo, tài liệu hướng dẫn sử dụng đã kiểm duyệt.

Mọi tài liệu đưa vào kho tri thức phải có đầy đủ metadata tối thiểu:

- `document_id`;
- tiêu đề tài liệu;
- phiên bản;
- ngày hiệu lực;
- ngày hết hiệu lực nếu có;
- chủ sở hữu chuyên môn;
- đơn vị phê duyệt;
- phạm vi áp dụng;
- nhóm tuổi hoặc quần thể áp dụng;
- ngôn ngữ;
- trạng thái tài liệu: nháp, hiệu lực, thay thế, ngừng hiệu lực;
- mức độ bảo mật và phân quyền truy cập.

## 6. Yêu cầu chức năng

| Mã | Yêu cầu | Mức độ |
| --- | --- | --- |
| RAG-F-01 | Hệ thống phải kiểm tra câu hỏi đầu vào và phân loại tối thiểu thành: truy vấn tri thức, yêu cầu giải thích, yêu cầu tóm tắt, yêu cầu soạn nháp, yêu cầu ngoài phạm vi. | MUST |
| RAG-F-02 | Hệ thống phải kiểm tra quyền truy cập của người dùng trước khi truy hồi tài liệu hoặc dùng dữ liệu bệnh nhân trong phiên làm việc. | MUST |
| RAG-F-03 | Hệ thống phải truy hồi bằng chứng từ kho tri thức nội bộ đã phê duyệt và không được dùng nguồn ngoài kho tri thức nếu không có cấu hình cho phép riêng. | MUST |
| RAG-F-04 | Hệ thống phải trả về danh sách nguồn bằng chứng đã dùng, gồm tối thiểu tên tài liệu, phiên bản, đoạn trích liên quan và định danh tài liệu. | MUST |
| RAG-F-05 | Hệ thống phải cho phép truy hồi nhiều tài liệu và chỉ ra khi các nguồn có nội dung nhất quán hoặc xung đột. | MUST |
| RAG-F-06 | Khi nguồn bằng chứng không đủ, hệ thống phải từ chối trả lời hoặc yêu cầu người dùng làm rõ, thay vì tự suy diễn. | MUST |
| RAG-F-07 | Hệ thống phải hỗ trợ mẫu trả lời chuẩn cho từng use case: hỏi đáp tri thức, tóm tắt, giải thích, nháp báo cáo. | SHOULD |
| RAG-F-08 | Hệ thống phải hỗ trợ gắn evidence payload từ pipeline nguyên phát khi sinh giải thích hoặc nháp báo cáo. | MUST |
| RAG-F-09 | Hệ thống phải cho phép bác sỹ hoặc người dùng được phân quyền sửa, ghi chú hoặc bác bỏ đầu ra trước khi phát hành. | MUST |
| RAG-F-10 | Hệ thống phải lưu câu hỏi, nguồn truy hồi, đầu ra, người kích hoạt, thời gian sinh và phiên bản cấu hình để truy vết. | MUST |
| RAG-F-11 | Hệ thống phải đánh dấu rõ đầu ra nào là “hỗ trợ tham khảo”, đầu ra nào là “nháp cần duyệt”, và không được trình bày như kết luận cuối cùng. | MUST |
| RAG-F-12 | Hệ thống nên hỗ trợ truy vấn song ngữ Việt - Anh nếu kho tài liệu chứa tài liệu ở cả hai ngôn ngữ. | SHOULD |

## 7. Yêu cầu an toàn lâm sàng và guardrails

| Mã | Yêu cầu | Mức độ |
| --- | --- | --- |
| RAG-S-01 | Hệ thống không được phát sinh chẩn đoán mới nếu pipeline dự báo nguyên phát chưa sinh ra bằng chứng tương ứng. | MUST |
| RAG-S-02 | Hệ thống không được tạo y lệnh, kê đơn hoặc khuyến nghị điều trị bắt buộc. | MUST |
| RAG-S-03 | Mọi câu trả lời phải giới hạn trong phạm vi bằng chứng được truy hồi và phải nêu rõ khi thông tin không đủ. | MUST |
| RAG-S-04 | Prompt hệ thống phải có guardrail chống suy diễn, chống tiết lộ dữ liệu nhạy cảm và chống sử dụng nguồn chưa được cấp phép. | MUST |
| RAG-S-05 | Các use case explanation drafting và report drafting phải có human-in-the-loop trước khi đưa vào hồ sơ chuyên môn hoặc nghiên cứu. | MUST |
| RAG-S-06 | Hệ thống phải có cơ chế chặn hoặc cảnh báo khi người dùng yêu cầu kết luận vượt quá intended use của hệ thống. | MUST |
| RAG-S-07 | Hệ thống phải có bộ kiểm thử an toàn định kỳ để phát hiện hallucination, nguồn sai, bỏ sót cảnh báo hoặc vi phạm phạm vi sử dụng. | MUST |
| RAG-S-08 | Hệ thống nên có chế độ “refuse safely” với mẫu trả lời thống nhất cho các câu hỏi không đủ bằng chứng hoặc vượt phạm vi. | SHOULD |

## 8. Yêu cầu dữ liệu, quyền riêng tư và bảo mật

| Mã | Yêu cầu | Mức độ |
| --- | --- | --- |
| RAG-D-01 | Hệ thống chỉ được sử dụng lượng dữ liệu bệnh nhân tối thiểu cần thiết cho từng use case. | MUST |
| RAG-D-02 | Dữ liệu bệnh nhân đưa vào prompt hoặc context phải được khử định danh hoặc kiểm soát theo quyền truy cập đã phê duyệt. | MUST |
| RAG-D-03 | Hệ thống phải tách biệt kho tri thức chuẩn với dữ liệu episode vận hành và phải kiểm soát rõ luồng dữ liệu giữa hai lớp này. | MUST |
| RAG-D-04 | Mọi truy cập, truy vấn và phát hành đầu ra phải được ghi audit trail. | MUST |
| RAG-D-05 | Tài liệu và chỉ mục vector phải được phiên bản hóa và có khả năng truy xuất lại nguồn gốc. | MUST |
| RAG-D-06 | Hệ thống phải hỗ trợ RBAC theo vai trò người dùng, tối thiểu cho nhóm lâm sàng, nghiên cứu, kỹ thuật và quản trị. | MUST |
| RAG-D-07 | Tài liệu hết hiệu lực hoặc bị thay thế phải được gỡ khỏi tập phục vụ hoặc bị gắn cờ không cho dùng trong trả lời mới. | MUST |
| RAG-D-08 | Hệ thống nên hỗ trợ mã hóa dữ liệu khi lưu trữ và truyền tải theo chính sách hạ tầng bệnh viện. | SHOULD |

## 9. Yêu cầu về chất lượng tri thức và quản trị tài liệu

| Mã | Yêu cầu | Mức độ |
| --- | --- | --- |
| RAG-K-01 | Kho tri thức phải là kho đã chọn lọc, không phải kho dump tài liệu thô không kiểm duyệt. | MUST |
| RAG-K-02 | Mỗi tài liệu phải có chủ sở hữu chuyên môn chịu trách nhiệm nội dung. | MUST |
| RAG-K-03 | Phải có SOP nhập tài liệu, rà soát, phê duyệt, cập nhật và ngừng hiệu lực tài liệu. | MUST |
| RAG-K-04 | Phải có quy trình xử lý tài liệu xung đột, phiên bản chồng lấn hoặc thay đổi guideline. | MUST |
| RAG-K-05 | Hệ thống phải cho phép truy xuất từ câu trả lời ngược về đoạn tài liệu gốc để người dùng kiểm tra. | MUST |
| RAG-K-06 | Tài liệu trong kho phải được gắn phạm vi áp dụng, ví dụ Nhi khoa, người lớn, ngoại trú, nội trú, hồi sức, nghiên cứu. | MUST |
| RAG-K-07 | Hệ thống nên hỗ trợ đánh dấu mức độ ưu tiên nguồn, ví dụ guideline chính thức cao hơn tài liệu đào tạo nội bộ. | SHOULD |

## 10. Yêu cầu fairness và tính đại diện

| Mã | Yêu cầu | Mức độ |
| --- | --- | --- |
| RAG-FR-01 | Phải mô tả quần thể đích và bối cảnh sử dụng của hệ thống RAG trong care pathway. | MUST |
| RAG-FR-02 | Phải đánh giá mức độ đại diện của kho tri thức đối với quần thể Nhi khoa đích, bao gồm nhóm tuổi, bối cảnh khoa phòng và nguồn tài liệu. | MUST |
| RAG-FR-03 | Khi có khoảng trống tri thức cho một nhóm đối tượng, hệ thống phải nêu rõ giới hạn áp dụng trong đầu ra hoặc tài liệu sử dụng. | MUST |
| RAG-FR-04 | Phải xem xét nguy cơ thiên lệch do tài liệu người lớn, tài liệu từ bối cảnh khác hoặc tài liệu lỗi thời được áp vào bệnh nhi địa phương. | MUST |
| RAG-FR-05 | Nên đánh giá hiệu quả của hệ thống theo các nhóm người dùng và tình huống sử dụng chính để phát hiện chênh lệch chất lượng hỗ trợ. | SHOULD |

## 11. Yêu cầu usability và workflow

| Mã | Yêu cầu | Mức độ |
| --- | --- | --- |
| RAG-U-01 | Phải mô tả rõ người dùng nào được dùng hệ thống, dùng ở bước nào của workflow và yêu cầu trình độ tối thiểu để diễn giải đầu ra. | MUST |
| RAG-U-02 | Hệ thống phải hiển thị cảnh báo rằng đầu ra là hỗ trợ tham khảo, không thay thế quyết định chuyên môn. | MUST |
| RAG-U-03 | Hệ thống phải hỗ trợ mở tài liệu gốc hoặc xem đoạn bằng chứng gốc từ giao diện trả lời. | MUST |
| RAG-U-04 | Hệ thống phải hỗ trợ ghi nhận phản hồi người dùng theo các trạng thái tối thiểu: chấp nhận, chỉnh sửa, bác bỏ, nguồn không phù hợp. | MUST |
| RAG-U-05 | Hệ thống nên hỗ trợ giao diện để báo cáo lỗi nội dung, lỗi trích dẫn hoặc lỗi cập nhật tài liệu. | SHOULD |

## 12. Yêu cầu chế độ multi-model và thử nghiệm

| Mã | Yêu cầu | Mức độ |
| --- | --- | --- |
| RAG-MM-01 | Hệ thống phải hỗ trợ chế độ thử nghiệm nhiều model theo kiến trúc champion/challenger hoặc generator/verifier, thay vì để nhiều model cùng tự quyết định đầu ra cuối. | MUST |
| RAG-MM-02 | Trong môi trường vận hành có kiểm soát, chỉ một model được phép giữ vai trò sinh đầu ra chính cho người dùng cuối tại một thời điểm, trừ khi có phê duyệt riêng cho cơ chế hợp nhất nhiều model. | MUST |
| RAG-MM-03 | Khi so sánh nhiều model, hệ thống phải bảo đảm các model nhận cùng một input chuẩn hóa, cùng evidence payload, cùng template và cùng chính sách guardrail để bảo đảm tính công bằng của phép so sánh. | MUST |
| RAG-MM-04 | Hệ thống phải lưu riêng đầu ra, citations, trạng thái từ chối, lỗi schema, thời gian phản hồi và phiên bản cấu hình của từng model trong mỗi lượt thử nghiệm. | MUST |
| RAG-MM-05 | Hệ thống phải hỗ trợ chế độ shadow hoặc replay offline để model challenger chạy nền mà không ảnh hưởng trực tiếp đến workflow lâm sàng chính. | MUST |
| RAG-MM-06 | Hệ thống không được để model challenger tự động ghi đè đầu ra của model chính hoặc đầu ra đã được bác sỹ chỉnh sửa, nếu không có quy tắc hợp nhất đã được phê duyệt. | MUST |
| RAG-MM-07 | Hệ thống nên hỗ trợ chiến lược chạy có chọn lọc, ví dụ chỉ gọi model challenger ở các ca uncertainty cao, ca report drafting, hoặc ca có nhiều lần bị người dùng sửa. | SHOULD |
| RAG-MM-08 | Nếu dùng mô hình verifier, model verifier chỉ được phép chấm tính groundedness, kiểm tra schema, kiểm tra tuân thủ guardrail và gắn cờ rủi ro; model verifier không được tự ý mở rộng kết luận lâm sàng. | MUST |

## 13. Yêu cầu đối với form báo cáo được tạo ra

### 13.1. Phạm vi form báo cáo

Hệ thống phải hỗ trợ tối thiểu các loại đầu ra dạng form sau, tùy theo `template_id`:

- nháp báo cáo hỗ trợ đọc phim;
- nháp hội chẩn;
- biểu mẫu nghiên cứu;
- tóm tắt ca phục vụ reader study hoặc rà soát nội bộ.

### 13.2. Yêu cầu cấu trúc và quản trị form

| Mã | Yêu cầu | Mức độ |
| --- | --- | --- |
| RAG-RP-01 | Hệ thống phải có registry cho các mẫu form, mỗi mẫu có tối thiểu `template_id`, tên mẫu, phiên bản, intended use, người phê duyệt và trạng thái hiệu lực. | MUST |
| RAG-RP-02 | Mỗi form phải có schema rõ ràng, phân biệt trường bắt buộc, trường tùy chọn, kiểu dữ liệu, ràng buộc định dạng và quy tắc kiểm tra đầu vào. | MUST |
| RAG-RP-03 | Mỗi trường trong form phải truy xuất được nguồn gốc dữ liệu, ví dụ từ HIS/EMR, PACS, model output, evidence payload, tài liệu RAG hoặc người dùng nhập tay. | MUST |
| RAG-RP-04 | Hệ thống phải phân biệt rõ trường chỉ đọc, trường do AI đề xuất, trường cho phép chỉnh sửa và trường bắt buộc bác sỹ xác nhận lại trước khi duyệt. | MUST |
| RAG-RP-05 | Nội dung AI sinh trong form phải gắn với bằng chứng hoặc citations tương ứng ở mức trường, mục hoặc đoạn văn, sao cho người dùng kiểm tra ngược được. | MUST |
| RAG-RP-06 | Form phải hiển thị rõ cảnh báo rằng đây là nháp do hệ thống hỗ trợ sinh ra và chưa phải văn bản chuyên môn cuối cùng cho đến khi được phê duyệt. | MUST |
| RAG-RP-07 | Hệ thống phải thể hiện uncertainty, giới hạn bằng chứng hoặc trạng thái thiếu dữ liệu ngay trong form khi có ảnh hưởng tới diễn giải nội dung. | MUST |
| RAG-RP-08 | Hệ thống phải hỗ trợ workflow trạng thái tối thiểu cho form: `draft`, `under_review`, `edited`, `approved`, `rejected`, `archived`. | MUST |
| RAG-RP-09 | Hệ thống phải lưu lịch sử chỉnh sửa, người sửa, thời gian sửa, nội dung trước và sau, cùng với model version và template version đã dùng để sinh form. | MUST |
| RAG-RP-10 | Hệ thống không được cho phép form tự sinh thêm chẩn đoán, khuyến nghị điều trị bắt buộc hoặc kết luận vượt quá bằng chứng đã truy hồi và phạm vi intended use. | MUST |
| RAG-RP-11 | Hệ thống phải hỗ trợ xuất form ít nhất ở dạng JSON nội bộ và dạng hiển thị cho người dùng; các định dạng như PDF, DOCX hoặc tích hợp HL7/FHIR nên được thiết kế như lớp xuất riêng. | SHOULD |
| RAG-RP-12 | Hệ thống nên hỗ trợ cơ chế diff để người duyệt xem phần nào là nội dung AI sinh, phần nào là nội dung người dùng đã sửa. | SHOULD |

## 14. Yêu cầu giao diện

| Mã | Yêu cầu | Mức độ |
| --- | --- | --- |
| RAG-UI-01 | Giao diện phải phân vai rõ theo nhóm người dùng tối thiểu: lâm sàng, nghiên cứu, kỹ thuật và quản trị. | MUST |
| RAG-UI-02 | Giao diện trả lời phải hiển thị đồng thời nội dung trả lời, nguồn bằng chứng, phiên bản tài liệu, trạng thái uncertainty và nhãn cảnh báo về intended use. | MUST |
| RAG-UI-03 | Giao diện phải cho phép mở nhanh đoạn tài liệu gốc, xem nguồn đối chiếu và kiểm tra citations mà không cần rời khỏi phiên làm việc hiện tại. | MUST |
| RAG-UI-04 | Giao diện không được hiển thị chain-of-thought hoặc reasoning thô của model cho người dùng cuối trong môi trường lâm sàng. | MUST |
| RAG-UI-05 | Giao diện phải hiển thị rõ model version, template version và thời điểm sinh đầu ra cho mọi câu trả lời hoặc form được tạo. | MUST |
| RAG-UI-06 | Giao diện phải cung cấp màn hình rà soát form báo cáo với các trường có thể chỉnh sửa, trường bị khóa, cảnh báo thiếu dữ liệu và trạng thái duyệt. | MUST |
| RAG-UI-07 | Giao diện phải hỗ trợ người dùng ghi nhận phản hồi, bác bỏ nội dung, báo lỗi citation và gửi nhận xét để phục vụ cải tiến hệ thống. | MUST |
| RAG-UI-08 | Nếu hệ thống chạy chế độ multi-model thử nghiệm, giao diện chuyên dụng cho người được phân quyền phải cho phép xem so sánh giữa các model theo các trục tối thiểu: answer, citation, trạng thái từ chối, lỗi schema và latency. | SHOULD |
| RAG-UI-09 | Giao diện lâm sàng chính không được hiển thị so sánh nhiều model hoặc chi tiết thử nghiệm nếu các thông tin đó không cần cho quyết định chuyên môn của người dùng cuối. | MUST |
| RAG-UI-10 | Giao diện phải hỗ trợ hiển thị tốt trên desktop và laptop dùng trong môi trường bệnh viện; hỗ trợ thiết bị di động là tùy chọn ở pha đầu. | SHOULD |
| RAG-UI-11 | Giao diện nên áp dụng các nguyên tắc accessibility cơ bản: độ tương phản đủ, trạng thái rõ ràng, điều hướng bàn phím cho màn hình rà soát và cảnh báo không chỉ phụ thuộc vào màu sắc. | SHOULD |
| RAG-UI-12 | Giao diện phải fail closed ở các tình huống lỗi quan trọng, ví dụ không hiển thị nội dung đã bị cắt cụt hoặc nội dung không qua kiểm tra schema như thể đó là đầu ra hợp lệ. | MUST |

## 15. Yêu cầu đánh giá hệ thống

### 15.1. Nguyên tắc đánh giá

- Tập phát triển và tập đánh giá phải tách biệt.
- Nếu có tối ưu prompt, chunking, reranking hoặc retrieval policy thì không được dùng chung bộ câu hỏi đánh giá cuối để tuning.
- Nếu có đánh giá ngoài mẫu, nên tách theo thời gian, khoa phòng hoặc cơ sở để phản ánh use case thật.
- Các bài kiểm tra an toàn phải có bộ ca dương tính và âm tính, bao gồm ca thiếu bằng chứng, ca xung đột nguồn, ca vượt phạm vi và ca có dữ liệu nhạy cảm.
- Nếu có chế độ thử nghiệm nhiều model, các model phải được so sánh trên cùng một tập ca, cùng evidence payload, cùng template và cùng tiêu chí chấm điểm.

### 15.2. Chỉ số đánh giá tối thiểu

| Nhóm chỉ số | Mô tả |
| --- | --- |
| Retrieval quality | Recall@k, precision@k, tỷ lệ truy hồi đúng tài liệu chuẩn, tỷ lệ bỏ sót tài liệu ưu tiên. |
| Grounded generation | Tỷ lệ câu trả lời được chống đỡ đầy đủ bởi bằng chứng, tỷ lệ nội dung vượt nguồn, tỷ lệ trích dẫn sai. |
| Safe abstention | Tỷ lệ từ chối đúng khi không đủ bằng chứng hoặc vượt phạm vi. |
| Workflow usefulness | Tỷ lệ người dùng đánh giá đầu ra hữu ích, thời gian hoàn thành tác vụ, tỷ lệ cần sửa tay. |
| Governance quality | Độ đầy đủ audit trail, tỷ lệ tài liệu có metadata đầy đủ, thời gian cập nhật sau khi guideline thay đổi. |
| Form quality | Tỷ lệ form hợp lệ theo schema, tỷ lệ trường bắt buộc được điền đúng, tỷ lệ form cần sửa tay ở mức nghiêm trọng. |
| Multi-model comparison | Tỷ lệ đồng thuận giữa champion và challenger, tỷ lệ challenger phát hiện lỗi groundedness hoặc lỗi schema mà champion bỏ sót. |

### 15.3. Tiêu chí nghiệm thu nội bộ đề xuất

Các ngưỡng dưới đây là mục tiêu nội bộ đề xuất cho giai đoạn pilot và có thể điều chỉnh theo thực tế dữ liệu:

| Mã | Tiêu chí | Mục tiêu nội bộ đề xuất |
| --- | --- | --- |
| RAG-A-01 | Tỷ lệ câu trả lời có trích dẫn nguồn hợp lệ | >= 95% |
| RAG-A-02 | Tỷ lệ câu trả lời có nội dung vượt nguồn trong bộ test an toàn | = 0 đối với ca mức nghiêm trọng cao |
| RAG-A-03 | Tỷ lệ từ chối đúng ở ca không đủ bằng chứng | >= 90% |
| RAG-A-04 | Tỷ lệ tài liệu dùng trong trả lời có metadata đầy đủ | 100% |
| RAG-A-05 | Tỷ lệ phiên trả lời có audit trail đầy đủ | 100% |
| RAG-A-06 | Median latency cho truy vấn chuẩn | < 8 giây |
| RAG-A-07 | Tỷ lệ người dùng lâm sàng đánh giá đầu ra hữu ích trong pilot | >= 70% |
| RAG-A-08 | Tỷ lệ form báo cáo sinh ra hợp lệ theo schema ở bộ test chuẩn | >= 95% |
| RAG-A-09 | Tỷ lệ ca mà challenger phát hiện đúng lỗi groundedness hoặc lỗi schema quan trọng | được theo dõi định kỳ và tăng theo từng vòng cải tiến |

## 16. Yêu cầu nghiên cứu, minh bạch và báo cáo theo chuẩn y tế

| Mã | Yêu cầu | Mức độ |
| --- | --- | --- |
| RAG-R-01 | Phải có tài liệu protocol hoặc technical protocol mô tả intended use, nguồn dữ liệu, phương pháp đánh giá và giới hạn của hệ thống. | MUST |
| RAG-R-02 | Nếu hệ thống được đưa vào nghiên cứu đánh giá chính thức, phải có thông tin về phê duyệt đạo đức hoặc miễn trừ phù hợp. | MUST |
| RAG-R-03 | Phải mô tả rõ người dùng đích, quần thể đích, bối cảnh sử dụng, care pathway và giới hạn áp dụng của hệ thống. | MUST |
| RAG-R-04 | Phải có tuyên bố về khả năng chia sẻ protocol, dữ liệu, code, prompt, bộ test và mức độ hạn chế truy cập nếu có. | MUST |
| RAG-R-05 | Phải có mô tả fairness, tính đại diện của nguồn tri thức, và các giới hạn có thể ảnh hưởng đến khả năng khái quát hóa. | MUST |
| RAG-R-06 | Phải mô tả rõ cách tính các chỉ số đánh giá, tập phát triển, tập đánh giá và mọi thay đổi cấu hình có ảnh hưởng đến kết quả. | MUST |
| RAG-R-07 | Nên có đăng ký nghiên cứu khi triển khai reader study, silent deployment có thu thập kết quả hoặc pilot đánh giá có cấu trúc. | SHOULD |

## 17. Yêu cầu vận hành và change control

| Mã | Yêu cầu | Mức độ |
| --- | --- | --- |
| RAG-O-01 | Phải có registry cho phiên bản tài liệu, chỉ mục, prompt, retrieval policy và cấu hình sinh đầu ra. | MUST |
| RAG-O-02 | Phải có quy trình phê duyệt thay đổi trước khi cập nhật tài liệu hoặc thay đổi logic retrieval trong môi trường vận hành. | MUST |
| RAG-O-03 | Phải có playbook rollback khi phát hiện tài liệu sai, cấu hình lỗi hoặc tăng sự cố hallucination. | MUST |
| RAG-O-04 | Phải giám sát tối thiểu các nhóm drift sau: drift tài liệu, drift truy vấn, drift workflow sử dụng và drift chất lượng đầu ra. | MUST |
| RAG-O-05 | Phải có cơ chế cảnh báo khi guideline hoặc SOP nguồn thay đổi nhưng chỉ mục chưa được cập nhật. | MUST |
| RAG-O-06 | Hệ thống nên hỗ trợ phân tích log để tìm nhóm câu hỏi thất bại lặp lại và đưa vào vòng cải tiến liên tục. | SHOULD |

## 18. Danh sách đầu ra tối thiểu của hệ thống

Hệ thống RAG ở mức prototype có kiểm soát nên tạo ra tối thiểu các đầu ra sau:

- kho tri thức nội bộ đã chọn lọc và có metadata;
- pipeline lập chỉ mục và tái lập chỉ mục có audit trail;
- thư viện prompt và guardrail;
- API hoặc dịch vụ truy vấn RAG;
- giao diện trả lời có trích dẫn nguồn;
- registry cho template form báo cáo và schema tương ứng;
- giao diện rà soát và duyệt form báo cáo;
- dashboard vận hành tối thiểu cho log, phản hồi và sự cố;
- dashboard hoặc chế độ phân tích cho champion/challenger khi bật thử nghiệm nhiều model;
- bộ test an toàn và bộ test đánh giá offline;
- protocol kỹ thuật và tài liệu intended use;
- runbook vận hành và playbook rollback.

## 19. Điều kiện go/no-go trước khi vào pilot

Hệ thống chỉ nên chuyển từ nghiên cứu nội bộ sang silent mode hoặc pilot khi đồng thời đạt các điều kiện sau:

- hoàn tất protocol và phê duyệt liên quan;
- kho tri thức đã được chọn lọc, phiên bản hóa và có chủ sở hữu chuyên môn;
- đạt bộ tiêu chí nghiệm thu nội bộ tối thiểu;
- các template form báo cáo trọng yếu đã được schema hóa, rà soát nội dung và kiểm thử workflow duyệt;
- có audit trail, phân quyền và cơ chế rollback hoạt động;
- hoàn tất bộ test an toàn cho hallucination, leakage và vượt phạm vi;
- nếu bật chế độ nhiều model, đã xác định rõ champion, challenger và quy tắc không cho challenger can thiệp trực tiếp vào đầu ra lâm sàng;
- đã huấn luyện hoặc hướng dẫn người dùng đích về intended use và giới hạn hệ thống.

## 20. Kết luận định hướng

Hệ thống RAG trong bối cảnh này phải được xem là một thành phần tri thức có kiểm soát, gắn chặt với workflow lâm sàng và nghiên cứu, chứ không phải chatbot tự do. Mọi yêu cầu kỹ thuật phải phục vụ bốn mục tiêu cốt lõi: đúng nguồn, đúng phạm vi, đúng vai trò và truy vết được. Việc triển khai chỉ có ý nghĩa khi đồng thời bảo đảm an toàn lâm sàng, tính hữu dụng cho người dùng, khả năng đánh giá minh bạch và quản trị thay đổi theo vòng đời.