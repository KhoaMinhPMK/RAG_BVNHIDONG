ĐỀ CƯƠNG TỔNG HỢP NGHIÊN CỨU VÀ TRIỂN KHAI KỸ THUẬT
XÂY DỰNG VÀ THẨM ĐỊNH NGOÀI MẪU MÔ HÌNH HỌC MÁY ĐA PHƯƠNG THỨC HỖ TRỢ CHẨN ĐOÁN HÌNH ẢNH VIÊM PHỔI NHI KHOA TỪ X-QUANG NGỰC VÀ DỮ LIỆU LÂM SÀNG
Phần I: Đề cương nghiên cứu theo khung IMRAD. Phần II: Đề cương kỹ thuật AI/ML/LLM triển khai thực dụng 12-24 tháng.
Loại tài liệu
Đề cương tổng hợp 02 phần: nghiên cứu IMRAD và triển khai kỹ thuật AI/ML/LLM
Mục đích sử dụng
Phục vụ hồ sơ nghiên cứu, hồ sơ kỹ thuật, xin chấp thuận đạo đức, chuẩn bị prototype và công bố
Trọng tâm học thuật
Khoảng trống nghiên cứu, kiến trúc dữ liệu, mô hình đa phương thức, LLM có kiểm soát, MLOps và roadmap triển khai
Đối tượng áp dụng
Nhóm nghiên cứu lâm sàng, chẩn đoán hình ảnh, kỹ sư y sinh, khoa học dữ liệu, CNTT y tế, quản trị chất lượng
Phiên bản
Bản Word tổng hợp, rà soát theo nguồn công bố và hướng dẫn quốc tế hiện hành đến tháng 3 năm 2026


Ghi chú định hướng: đề cương này được xây dựng theo góc nhìn của bác sỹ điều trị và nhà nghiên cứu học thuật y học, nhưng được viết theo cấu trúc đủ chặt để có thể chuyển tiếp sang hồ sơ nghiên cứu triển khai, hồ sơ xin chấp thuận đạo đức hoặc bản nháp bài báo khoa học.

TÓM TẮT ĐỊNH HƯỚNG ĐỀ TÀI
Đề tài được đặt ra để xử lý trực diện ba giới hạn lớn đang tồn tại trong y văn về trí tuệ nhân tạo cho viêm phổi Nhi khoa. Thứ nhất, nhiều mô hình hiện nay vẫn phụ thuộc vào dữ liệu X-quang đơn trung tâm hoặc bộ dữ liệu công khai có cấu trúc chưa phản ánh đầy đủ thực hành bệnh viện. Thứ hai, số lượng nghiên cứu có ngoại kiểm độc lập, đặc biệt ngoại kiểm tiền cứu trong bối cảnh thực, còn hạn chế. Thứ ba, các mô hình chỉ dựa trên ảnh đơn lẻ vẫn chưa mô phỏng đúng quy trình chẩn đoán lâm sàng vốn dựa đồng thời trên hình ảnh, triệu chứng, xét nghiệm và diễn tiến bệnh.
Luận điểm trung tâm của đề cương là một mô hình học máy có giá trị lâm sàng cho viêm phổi Nhi khoa phải được phát triển trên dữ liệu trẻ em thực, có chuẩn tham chiếu chặt chẽ, có cơ chế giải thích được, có kiểm định ngoài mẫu và ưu tiên tích hợp đa phương thức để tiến gần hơn tới tư duy bệnh nhi số hóa và hỗ trợ quyết định theo ngữ cảnh.
BẢNG TÓM TẮT KHOẢNG TRỐNG NGHIÊN CỨU VÀ ĐÁP ỨNG CỦA ĐỀ TÀI
Trục vấn đề
Biểu hiện trong y văn
Rủi ro học thuật/lâm sàng
Đáp ứng của đề tài
Dữ liệu
Lệ thuộc bộ dữ liệu công khai, thiên lệch đơn trung tâm, chưa phản ánh đầy đủ biến thiên tuổi, tư thế chụp và thiết bị.
Hiệu năng đẹp trên benchmark nhưng giảm khi chuyển môi trường triển khai.
Xây dựng tập dữ liệu đa nguồn, ưu tiên bệnh nhân Nhi khoa thực, tách rõ tập phát triển, hiệu chỉnh và ngoại kiểm.
Chuẩn tham chiếu
Nhãn viêm phổi không đồng nhất giữa nghiên cứu; nhiều bài chỉ dựa vào nhãn có sẵn hoặc báo cáo phim đơn lẻ.
Giảm độ tin cậy khoa học, khó diễn giải giá trị lâm sàng.
Sử dụng quy trình đọc phim độc lập nhiều người đọc và chuẩn lâm sàng tổng hợp.
Kiểm định
Thiếu ngoại kiểm độc lập và thiếu nghiên cứu tiền cứu.
Không biết mô hình có khả năng mang theo sang cơ sở khác hay không.
Thiết kế hai pha hồi cứu – tiền cứu, có thẩm định ngoài mẫu.
Đa phương thức
Ảnh X-quang thường được dùng đơn lẻ, ít kết hợp văn bản lâm sàng và xét nghiệm theo luồng khám thực.
Khó mô phỏng quyết định chẩn đoán thật của bác sỹ.
Xây dựng mô hình hợp nhất X-quang ngực, dữ liệu xét nghiệm và văn bản lâm sàng.
Giải thích và triển khai
Nhiều mô hình chỉ trả xác suất mà thiếu cơ chế giải thích và giám sát sau triển khai.
Giảm niềm tin của người dùng và khó quản trị chất lượng.
Thiết kế lớp explainability, human-in-the-loop, giám sát drift và đánh giá đội hình người – AI.

I. INTRODUCTION
1. Bối cảnh và tính cấp thiết
Viêm phổi tiếp tục là một trong những nguyên nhân tử vong hàng đầu ở trẻ em dưới 5 tuổi. Trong thực hành Nhi khoa, X-quang ngực vẫn là phương tiện hình ảnh có tính sẵn có cao, tốc độ triển khai nhanh và chi phí chấp nhận được. Trong bối cảnh đó, học máy và học sâu đã được ứng dụng ngày càng mạnh để hỗ trợ phát hiện viêm phổi từ ảnh X-quang, song khoảng cách giữa hiệu năng trên bộ dữ liệu nghiên cứu và giá trị triển khai thực trong môi trường bệnh viện vẫn còn đáng kể [1][2][3].
Nghiên cứu của Chen và cộng sự là một cột mốc quan trọng vì sử dụng phương pháp chuẩn hóa của WHO cho viêm phổi X-quang trẻ em, tiền huấn luyện mô hình trên CheXpert với 224.316 phim người lớn, tinh chỉnh trên bộ dữ liệu PERCH gồm 4.172 phim Nhi khoa và đạt AUC trung bình 0,928 trên ảnh PERCH cùng 0,977 trên bộ ảnh WHO. Tuy nhiên, chính nghiên cứu này cũng chỉ ra hiệu năng bị ảnh hưởng rõ bởi mức độ đồng thuận giữa người đọc, qua đó cho thấy chất lượng nhãn và chuẩn tham chiếu là yếu tố nền tảng chứ không chỉ là chi tiết kỹ thuật [1].
Các nghiên cứu gần đây tiếp tục mở rộng từ CNN sang Vision Transformer và các kiến trúc hợp nhất đa phương thức. Xu hướng này phản ánh nhu cầu chuyển từ mô hình phân loại ảnh đơn lẻ sang mô hình gần hơn với quyết định lâm sàng, nơi bác sỹ cùng lúc xem X-quang, triệu chứng, xét nghiệm và văn bản bệnh án [2][4].
2. Khoảng trống nghiên cứu trọng tâm
Khoảng trống thứ nhất là tính đại diện của dữ liệu. Phần lớn mô hình công bố vẫn được huấn luyện trên tập ảnh công khai hoặc dữ liệu đơn trung tâm, chưa phản ánh đầy đủ sự khác biệt của bệnh nhi theo lứa tuổi, tư thế chụp, thiết bị, chất lượng ảnh và bệnh đi kèm. Điều này tạo nguy cơ mô hình đạt hiệu năng cao trong nghiên cứu nhưng giảm mạnh khi đổi môi trường triển khai [2][3].
Khoảng trống thứ hai là sự thiếu nhất quán của chuẩn tham chiếu. Y văn đang đồng thời tồn tại nhiều đích đầu ra khác nhau như viêm phổi nói chung, WHO primary endpoint pneumonia, phân biệt căn nguyên, phân tầng mức độ nặng hoặc dự đoán đáp ứng. Việc thiếu thống nhất này khiến nhiều mô hình đúng về mặt kỹ thuật nhưng chưa chắc trả lời trúng câu hỏi lâm sàng cần dùng [1][4].
Khoảng trống thứ ba, đồng thời là khoảng trống quan trọng nhất, là thiếu ngoại kiểm và thiếu kiểm chứng trong dữ liệu tiền cứu hoặc dữ liệu ngoài môi trường phát triển. Nghiên cứu pilot đa trung tâm tại Nigeria công bố năm 2025 nhấn mạnh rằng đa số mô hình AI cho viêm phổi trẻ em vẫn thiếu xác thực trên dữ liệu lâm sàng tiền cứu ở bối cảnh hạn chế nguồn lực, làm giảm độ tin cậy về khả năng áp dụng thực tiễn [3].
Khoảng trống thứ tư là mức độ tích hợp đa phương thức còn hạn chế. Dù đã có nghiên cứu đa mô thức ở trẻ 0–13 tuổi sử dụng đồng thời X-quang ngực, xét nghiệm và văn bản lâm sàng, phần lớn công bố vẫn là hồi cứu một trung tâm. Điều đó cho thấy hướng đi đã hình thành nhưng chưa đủ trưởng thành để khẳng định năng lực vận hành trong hệ thống khám chữa bệnh thường quy [4].
Khoảng trống thứ năm là explainability, quản trị triển khai và định hướng digital twin. Trong khi các tổng quan gần đây về digital twin y tế cho thấy xu hướng tích hợp dữ liệu đa nguồn để tạo ra mô hình bệnh nhân số hóa có thể hỗ trợ quyết định cá thể hóa, phần lớn nghiên cứu viêm phổi Nhi khoa vẫn dừng ở mức mô hình phân loại ảnh đơn thời điểm [5].
3. Luận điểm khoa học
Đề tài xuất phát từ luận điểm rằng một mô hình học máy hỗ trợ chẩn đoán viêm phổi Nhi khoa chỉ thực sự có giá trị khi được xây dựng trên dữ liệu Nhi khoa thực, có chuẩn tham chiếu rõ, có khả năng diễn giải, có ngoại kiểm độc lập và ưu tiên tích hợp dữ liệu lâm sàng. Cách tiếp cận này vừa tăng tính đúng đắn học thuật, vừa tăng khả năng chuyển giao sang thực hành lâm sàng và sản phẩm số y tế.
4. Mục tiêu nghiên cứu
Mục tiêu tổng quát của nghiên cứu là xây dựng và thẩm định ngoài mẫu một mô hình học máy đa phương thức hỗ trợ chẩn đoán hình ảnh viêm phổi Nhi khoa từ X-quang ngực và dữ liệu lâm sàng, có khả năng giải thích và có giá trị triển khai thực hành.
Mục tiêu chuyên biệt
Nội dung thực hiện
Mục tiêu 1
Xây dựng bộ dữ liệu Nhi khoa chuẩn hóa gồm ảnh X-quang ngực, dữ liệu lâm sàng cấu trúc và văn bản bệnh án ngắn, kèm nhãn chẩn đoán được chuẩn hóa.
Mục tiêu 2
Phát triển và so sánh các mô hình nền: CNN, Vision Transformer và mô hình hợp nhất đa phương thức.
Mục tiêu 3
Đánh giá mô hình trên tập nội bộ, tập hiệu chỉnh ngưỡng và tập ngoại kiểm độc lập; ưu tiên thêm pha tiền cứu khi khả thi.
Mục tiêu 4
Đánh giá khả năng giải thích của mô hình, mức phù hợp với luồng quyết định lâm sàng và mức chấp nhận của người dùng cuối.

5. Giả thuyết nghiên cứu
Giả thuyết thứ nhất: mô hình đa phương thức kết hợp X-quang ngực với dữ liệu lâm sàng sẽ có hiệu năng cao hơn mô hình chỉ dùng ảnh. Giả thuyết thứ hai: mô hình được huấn luyện trên dữ liệu Nhi khoa thực và được thẩm định ngoài mẫu sẽ cho ước lượng trung thực hơn về giá trị lâm sàng so với mô hình tối ưu hóa trên bộ dữ liệu công khai. Giả thuyết thứ ba: cơ chế giải thích theo vùng tổn thương và theo đặc trưng lâm sàng sẽ làm tăng mức chấp nhận của bác sỹ đối với hệ thống hỗ trợ quyết định [3][4][6][7].
II. METHODS
1. Thiết kế nghiên cứu
Nghiên cứu được thiết kế theo mô hình phát triển và thẩm định mô hình chẩn đoán, gồm hai pha liên tiếp. Pha thứ nhất là nghiên cứu hồi cứu đa trung tâm để xây dựng cơ sở dữ liệu, phát triển mô hình và tối ưu cấu hình. Pha thứ hai là nghiên cứu hồi cứu độc lập hoặc tiền cứu tại cơ sở ngoài trung tâm phát triển để đánh giá tính mang theo của mô hình. Thiết kế này nhằm khắc phục trực tiếp điểm yếu lớn của y văn là thiếu ngoại kiểm độc lập và thiếu kiểm chứng trong bối cảnh làm việc thực [3][6].
2. Đối tượng nghiên cứu và tiêu chuẩn chọn mẫu
Đối tượng nghiên cứu là trẻ em có chỉ định chụp X-quang ngực vì nghi ngờ viêm phổi hoặc bệnh lý hô hấp cấp. Nên phân tầng nhóm tuổi theo giai đoạn phát triển, ví dụ 0–2 tuổi, trên 2–5 tuổi, trên 5–10 tuổi và trên 10–15 tuổi, để phản ánh khác biệt giải phẫu và biểu hiện hình ảnh theo lứa tuổi. Các trường hợp ảnh quá mờ, nhiễu nặng, có dị tật phổi – tim bẩm sinh phức tạp hoặc hồ sơ lâm sàng thiếu dữ liệu cốt lõi sẽ bị loại trừ.
3. Chuẩn tham chiếu chẩn đoán
Chuẩn tham chiếu được đề xuất theo hai tầng. Tầng một là chuẩn hình ảnh, dựa trên đọc phim độc lập của ít nhất hai bác sỹ chẩn đoán hình ảnh hoặc hô hấp Nhi khoa; khi có bất đồng, một bác sỹ thứ ba hoặc hội chẩn đồng thuận sẽ quyết định. Tầng hai là chuẩn lâm sàng tổng hợp, dựa trên chẩn đoán ra viện, xét nghiệm viêm, diễn tiến điều trị, căn nguyên khi có và đáp ứng theo dõi. Cách làm này nhằm giảm lệ thuộc vào một báo cáo phim đơn lẻ và bám sát các khuyến nghị báo cáo, đánh giá mô hình dự đoán dùng học máy [1][6].
4. Nguồn dữ liệu và biến số
Dữ liệu nghiên cứu gồm ba nhóm chính. Nhóm thứ nhất là ảnh X-quang ngực thẳng trước sau hoặc sau trước và các metadata chụp cơ bản. Nhóm thứ hai là dữ liệu lâm sàng cấu trúc như tuổi, giới, sốt, ho, thở nhanh, SpO2, CRP, bạch cầu, neutrophil, thời gian khởi bệnh và chẩn đoán ra viện. Nhóm thứ ba là văn bản lâm sàng ngắn, ví dụ lý do nhập viện, mô tả khám phổi, diễn tiến ban đầu hoặc kết luận lâm sàng. Nghiên cứu đa mô thức năm 2025 trên Scientific Reports cho thấy chính ba lớp dữ liệu này là cấu trúc gần nhất với quy trình ra quyết định thực đối với CAP ở trẻ em [4].
5. Quy trình phát triển mô hình
Ảnh X-quang sẽ được chuẩn hóa kích thước, kiểm soát chất lượng và, khi thích hợp, tách vùng phổi hoặc cắt vùng quan tâm để hạn chế tín hiệu nhiễu ngoài phổi. Trên nhánh hình ảnh, có thể triển khai các backbone chuẩn như DenseNet, ResNet và Vision Transformer để so sánh. Trên nhánh văn bản, có thể dùng mô hình ngôn ngữ gọn cho tiếng Anh hoặc pipeline biểu diễn văn bản y khoa đã tinh chỉnh. Trên nhánh dữ liệu cấu trúc, có thể dùng multilayer perceptron, gradient boosting hoặc deep tabular model. Bước hợp nhất cuối cùng sử dụng early fusion, mid fusion hoặc late fusion, tùy theo thiết kế thí nghiệm [2][4].
Khuyến nghị về mặt báo cáo và quản trị là toàn bộ quá trình phát triển mô hình phải được mô tả theo hướng dẫn TRIPOD+AI; nếu có nghiên cứu can thiệp tiền cứu đánh giá tác động của hệ thống lên quyết định lâm sàng, bản giao thức và báo cáo nên tham chiếu thêm SPIRIT-AI và CONSORT-AI [6][7][8].
6. Nhóm so sánh và thước đo đánh giá
Nghiên cứu nên có tối thiểu ba nhánh so sánh. Nhánh thứ nhất là mô hình chỉ dùng ảnh X-quang ngực. Nhánh thứ hai là mô hình chỉ dùng dữ liệu lâm sàng. Nhánh thứ ba là mô hình đa phương thức. Thước đo chính bao gồm AUC, độ nhạy, độ đặc hiệu, PPV, NPV, F1-score, độ hiệu chuẩn, decision curve và phân tích dưới nhóm theo tuổi, tư thế chụp, trung tâm và chất lượng ảnh. Cần đánh giá thêm explainability bằng heatmap hoặc attention map đối với vùng tổn thương, đồng thời phân tích các trường hợp sai điển hình để nhìn ra cơ chế lỗi.
7. Cỡ mẫu, chia tập dữ liệu và kiểm định ngoài mẫu
Phải bảo đảm độc lập theo bệnh nhân khi chia dữ liệu, không chia theo ảnh đơn lẻ để tránh rò rỉ dữ liệu. Cần tách riêng tập phát triển, tập hiệu chỉnh ngưỡng và tập ngoại kiểm; nếu nhiều cơ sở tham gia, nên để ít nhất một cơ sở làm ngoại kiểm độc lập. Khi có điều kiện, bổ sung một pha tiền cứu nhỏ nhằm đánh giá sự ổn định của mô hình trong điều kiện vận hành thật, vì đây chính là nút thắt mà nghiên cứu tại Nigeria đã cảnh báo [3].
8. Đạo đức nghiên cứu và quản trị vòng đời mô hình
Dữ liệu phải được khử định danh, quản lý truy cập phân quyền và lưu vết truy cập. Nếu mô hình được định hướng như thành phần của phần mềm hỗ trợ quyết định y khoa, việc thiết kế và quản trị cần gắn với tư duy total product life cycle. IMDRF đã ban hành văn bản chính thức năm 2025 về Good Machine Learning Practice gồm 10 nguyên tắc, nhấn mạnh dữ liệu đại diện cho quần thể đích, tách biệt tập huấn luyện – kiểm định, đánh giá trong điều kiện lâm sàng liên quan, cung cấp thông tin thiết yếu cho người dùng và theo dõi rủi ro tái huấn luyện sau triển khai [8].
III. RESULTS
1. Kết quả dự kiến cần trình bày
Phần kết quả dự kiến của nghiên cứu tương lai nên được tổ chức theo bốn lớp. Lớp thứ nhất là sơ đồ chọn mẫu và mô tả dân số nghiên cứu. Lớp thứ hai là hiệu năng của từng mô hình nền và của mô hình đa phương thức. Lớp thứ ba là kết quả ngoại kiểm và phân tích dưới nhóm. Lớp thứ tư là giải thích quyết định mô hình và phân tích sai số. Cách tổ chức này phù hợp với hướng công bố hiện đại của các nghiên cứu AI lâm sàng, giúp người đọc nhìn đồng thời cả độ mạnh mô hình lẫn tính sử dụng được [4][6].
2. Bộ bảng và hình khuyến nghị
Bản thảo bài báo hoàn chỉnh nên có tối thiểu một sơ đồ flowchart chọn mẫu, một bảng đặc điểm nền, một bảng so sánh hiệu năng các mô hình, một hình ROC, một hình calibration, một hình subgroup analysis và một hình explainability. Với nhánh đa phương thức, nên có thêm sơ đồ kiến trúc mô hình và bảng phân rã đóng góp của từng modality vào quyết định cuối cùng.
3. Kết quả học thuật kỳ vọng
Nghiên cứu kỳ vọng chứng minh được rằng mô hình đa phương thức cho hiệu năng và tính ổn định tốt hơn mô hình chỉ dùng ảnh đơn lẻ, đặc biệt trong những trường hợp biểu hiện hình ảnh không điển hình hoặc dữ liệu ảnh có biến thiên tư thế. Đồng thời, nghiên cứu kỳ vọng tạo ra ước lượng trung thực hơn về tính mang theo của mô hình thông qua ngoại kiểm, thay vì chỉ trình bày kết quả nội bộ quá tối ưu [3][4].
IV. DISCUSSION
1. Giá trị mới dự kiến
Giá trị mới thứ nhất của đề tài là chuyển trọng tâm từ mô hình đẹp trên benchmark sang mô hình có thể bước vào quy trình chẩn đoán Nhi khoa thật. Giá trị mới thứ hai là chuẩn tham chiếu chẩn đoán được thiết kế chặt hơn nhằm bảo đảm chất lượng nhãn. Giá trị mới thứ ba là tích hợp đa phương thức để mô phỏng đúng hơn logic tư duy của bác sỹ. Giá trị mới thứ tư là đưa ngoại kiểm và quản trị vòng đời mô hình thành thành phần lõi ngay từ giai đoạn đề cương [1][3][4][8].
2. Ý nghĩa lâm sàng và ý nghĩa công nghệ
Về lâm sàng, đề tài có thể tạo ra một công cụ hỗ trợ sàng lọc hoặc hỗ trợ đọc X-quang ngực cho bác sỹ Nhi khoa, đặc biệt ở nơi còn thiếu nhân lực chẩn đoán hình ảnh. Về công nghệ, đề tài đóng vai trò như bước nối từ AI đọc ảnh truyền thống sang hệ sinh thái mô hình bệnh nhi số hóa đa nguồn, tức hướng tiếp cận gần với digital twin hơn khi cho phép tích hợp dữ liệu theo thời gian và mở đường cho dự báo diễn tiến hay phân tầng nguy cơ [5].
3. Hạn chế dự kiến
Dù thiết kế đa trung tâm và đa phương thức, nghiên cứu vẫn có thể bị giới hạn bởi độ không đồng nhất của hồ sơ bệnh án, chênh lệch chất lượng ảnh giữa các cơ sở, chi phí chuẩn hóa dữ liệu và khó khăn trong duy trì quy trình gán nhãn nhiều người đọc. Ngoài ra, nếu chưa có một pha tiền cứu hoặc đánh giá tác động lên quyết định điều trị, nghiên cứu vẫn chủ yếu mới trả lời câu hỏi về hiệu năng chẩn đoán, chưa trả lời trọn vẹn câu hỏi về hiệu quả lâm sàng sau triển khai.
4. Kết luận định hướng
Đề cương này không đi theo lối mòn lặp lại một mô hình CNN hay Transformer trên bộ dữ liệu công khai. Điểm mấu chốt là xây dựng một nghiên cứu vừa có giá trị học thuật quốc tế vừa đủ thực dụng để chuyển thành dự án kỹ thuật – y sinh – lâm sàng: dữ liệu Nhi khoa thực, chuẩn tham chiếu rõ, mô hình đa phương thức, ngoại kiểm ngoài mẫu, cơ chế giải thích và quản trị vòng đời theo chuẩn AI y tế. Đây chính là vị trí mà đề tài có thể đóng góp khác biệt cho lĩnh vực.
Gói công việc
Nội dung chính
Đầu ra
Chủ thể nòng cốt
WP1
Thiết kế nghiên cứu, hồ sơ đạo đức, chuẩn dữ liệu, chuẩn nhãn và quy trình thu nhận ảnh.
Protocol, CRF, data dictionary, SOP gán nhãn.
Nhi khoa, CĐHA, kiểm soát nghiên cứu.
WP2
Xây dựng kho dữ liệu đa phương thức, khử định danh, kiểm tra chất lượng và chia tập dữ liệu.
Dataset phiên bản hóa, báo cáo QA dữ liệu.
Kỹ sư dữ liệu, CNTT y tế, quản trị PACS/HIS.
WP3
Phát triển mô hình ảnh, mô hình lâm sàng, mô hình văn bản và mô hình hợp nhất.
Baseline, mô hình tối ưu, mô tả kiến trúc.
Data scientist, kỹ sư AI, bác sỹ phản biện.
WP4
Ngoại kiểm, hiệu chỉnh ngưỡng, đánh giá explainability và phân tích lỗi.
Báo cáo validation, ma trận lỗi, dashboard đánh giá.
Nhóm AI và hội đồng chuyên gia lâm sàng.
WP5
Thiết kế nguyên mẫu phần mềm hỗ trợ quyết định và đánh giá khả dụng.
Prototype, giao diện, log sử dụng, quy trình human-in-the-loop.
Biomedical engineering, BA, UI/UX, lâm sàng.
WP6
Hoàn thiện bản thảo công bố, kế hoạch chuyển giao và khung giám sát sau triển khai.
Manuscript, kế hoạch MLOps, sổ tay người dùng.
PI, nhóm nghiên cứu, quản lý chất lượng.


PHẦN II. ĐỀ CƯƠNG KỸ THUẬT TRIỂN KHAI
Định vị tài liệu. Phần này được viết theo góc nhìn của kỹ sư thiết bị y tế - biomedical engineering, kết hợp tư duy sản phẩm số y tế với nhu cầu nghiên cứu lâm sàng/cận lâm sàng. Trọng tâm không chỉ là mô hình học máy, mà là toàn bộ chuỗi hiện thực hóa từ dữ liệu, mô hình, phần mềm, vận hành, an toàn và bằng chứng triển khai.
1. MỤC TIÊU
Mục tiêu tổng quát. Xây dựng một nền tảng AI đa phương thức hỗ trợ chẩn đoán hình ảnh viêm phổi Nhi khoa từ X-quang ngực, dữ liệu lâm sàng và văn bản bệnh án, có khả năng giải thích, truy vết, ngoại kiểm ngoài mẫu và triển khai thử nghiệm theo lộ trình kiểm soát trong môi trường bệnh viện.
Mã
Mục tiêu chuyên biệt
Đầu ra chính
M1
Thiết lập kho dữ liệu đa phương thức theo đơn vị episode lâm sàng, có khử định danh và phiên bản hóa.
Data mart nghiên cứu; data dictionary; SOP trích xuất và làm sạch dữ liệu.
M2
Xây dựng bộ nhãn chuẩn gồm nhãn hình ảnh nhiều người đọc và nhãn lâm sàng tổng hợp.
Sổ tay gán nhãn; ma trận đồng thuận; báo cáo chất lượng nhãn.
M3
Phát triển bộ mô hình nền gồm nhánh ảnh, nhánh tabular, nhánh text và mô hình fusion.
Benchmark mô hình; pipeline huấn luyện; mô hình ứng viên.
M4
Tạo lớp LLM có kiểm soát để tóm tắt hồ sơ, giải thích kết quả và hỗ trợ sinh nháp báo cáo.
Prompt library; RAG nội bộ; bộ kiểm soát an toàn đầu ra.
M5
Đóng gói hệ thống thành phần mềm nguyên mẫu tích hợp workflow lâm sàng.
API suy luận; giao diện nguyên mẫu; dashboard vận hành.
M6
Thực hiện ngoại kiểm, silent deployment, reader study và cơ chế giám sát sau triển khai.
Báo cáo xác thực; risk log; tiêu chí go/no-go cho mở rộng.

2. PHẠM VI
Nhóm phạm vi
Bao gồm
Chưa bao gồm trong pha nền
Dữ liệu
X-quang ngực DICOM; metadata chụp; dấu hiệu sinh tồn; xét nghiệm thường quy; văn bản bệnh án đầu vào; chẩn đoán ra viện.
CT, siêu âm phổi, dữ liệu thiết bị theo dõi liên tục, dữ liệu gen hoặc omics.
Nghiệp vụ
Sàng lọc ca nghi viêm phổi; hỗ trợ đọc phim; tạo giải thích hỗ trợ; hỗ trợ chuẩn bị báo cáo/hội chẩn; phản hồi người dùng.
Tự động ra y lệnh, tự động kê đơn, thay thế quyết định bác sỹ.
Người dùng
Bác sỹ Nhi khoa, bác sỹ chẩn đoán hình ảnh, kỹ thuật viên, nhà nghiên cứu, bộ phận CNTT y tế, kỹ sư y sinh.
Người dùng bên ngoài bệnh viện hoặc triển khai liên viện quy mô lớn ngay từ đầu.
Triển khai
Môi trường nghiên cứu, ngoại kiểm, silent mode, pilot có kiểm soát.
Triển khai đại trà toàn viện trước khi hoàn tất bằng chứng an toàn - hiệu quả.

3. KIẾN TRÚC DỮ LIỆU
3.1. Nguyên tắc thiết kế
Nguyên tắc 1. Đơn vị dữ liệu hạt nhân là episode lâm sàng của một bệnh nhi, không phải một ảnh đơn lẻ; mọi nguồn dữ liệu phải bám theo episode_id và timeline.
Nguyên tắc 2. Dữ liệu nghiên cứu và dữ liệu vận hành phải tách lớp rõ, có khử định danh, kiểm soát quyền truy cập và cơ chế truy xuất lại nguồn gốc.
Nguyên tắc 3. Mọi biến đầu vào dùng cho mô hình phải có định nghĩa, kiểu dữ liệu, đơn vị đo, nguồn sinh dữ liệu và quy tắc xử lý thiếu dữ liệu.
Nguyên tắc 4. Thiết kế kho dữ liệu phải cho phép mở rộng từ bài toán chẩn đoán nhị phân sang phân tầng nguy cơ, dự báo diễn tiến và mô phỏng theo hướng digital twin.
3.2. Nguồn dữ liệu và pipeline tiếp nhận
Nguồn
Dữ liệu chính
Chuẩn giao tiếp/định dạng
Ghi chú triển khai
PACS/RIS
Ảnh DICOM, metadata chụp, accession, modality, tư thế chụp.
DICOM, DICOMweb hoặc kết xuất nghiên cứu.
Bảo toàn ảnh gốc; tạo bản chuẩn hóa cho huấn luyện.
HIS/EMR
Thông tin hành chính, triệu chứng, thăm khám, chẩn đoán, diễn tiến, kết luận ra viện.
HL7/FHIR hoặc trích xuất bảng nghiên cứu nội bộ.
Cần map khóa bệnh nhân - episode - lần chụp.
LIS
CRP, bạch cầu, neutrophil, khí máu, xét nghiệm liên quan.
Bảng cấu trúc hoặc API nội bộ.
Đồng bộ mốc thời gian xét nghiệm với thời điểm chụp.
Kho nghiên cứu/labeling
Nhãn hình ảnh nhiều người đọc, consensus label, quality flags.
CSV/JSON/SQL.
Phải có audit trail cho mọi thay đổi nhãn.

3.3. Mô hình dữ liệu episode-based
Cấu phần tối thiểu của một episode. episode_id; patient_id đã khử định danh; thời điểm vào viện; thời điểm chụp X-quang; ảnh gốc DICOM; ảnh chuẩn hóa; metadata máy chụp; dấu hiệu sinh tồn; xét nghiệm gần thời điểm chụp; văn bản bệnh án đầu vào; kết luận đọc phim; consensus label; chẩn đoán ra viện; phản hồi bác sỹ sau sử dụng AI.
3.4. Cấu trúc vùng dữ liệu
Vùng dữ liệu
Mục đích
Nội dung
Kiểm soát
Bronze
Lưu bản sao gần nguyên trạng.
DICOM gốc, log trích xuất, bản dump bảng dữ liệu.
Read-only; hash kiểm toàn vẹn.
Silver
Làm sạch, chuẩn hóa, liên kết khóa.
Biến cấu trúc, text chuẩn hóa, ảnh chuyển định dạng nghiên cứu.
Quy tắc chuẩn hóa, unit mapping, missingness log.
Gold
Phục vụ huấn luyện, đánh giá và dashboard.
Feature tables, labels, cohort version, benchmark tables.
Versioning theo release; phê duyệt trước khi train.
Serving
Phục vụ suy luận thời gian gần thực.
Feature store online, model inputs, prediction outputs.
RBAC; audit trail; rollback plan.

3.5. Quy chế nhãn và quản trị chất lượng dữ liệu
A. Nhãn hình ảnh cần tối thiểu 02 người đọc độc lập; bất đồng được giải quyết bằng người đọc thứ ba hoặc hội chẩn đồng thuận.
B. Nhãn lâm sàng tổng hợp được hình thành từ chẩn đoán ra viện, diễn tiến sớm, xét nghiệm và phản ứng điều trị khi có dữ liệu phù hợp.
C. Bộ chỉ số chất lượng dữ liệu phải theo dõi độ đầy đủ, độ nhất quán thời gian, tần suất missingness, ảnh lỗi và tỷ lệ record bị loại.
D. Mọi lần tái gán nhãn hoặc điều chỉnh cohort phải để lại nhật ký thay đổi, người thực hiện, lý do và phiên bản ảnh hưởng.
4. KIẾN TRÚC MÔ HÌNH
Luận điểm kỹ thuật. Hệ thống không dùng một mô hình duy nhất. Chiến lược đề xuất là kiến trúc nhiều nhánh: mô hình ảnh làm trục chính, mô hình tabular và mô hình text làm trục bổ trợ, sau đó hợp nhất bằng fusion layer để phản ánh gần hơn cách bác sỹ ra quyết định.
Nhánh
Mô hình ưu tiên
Đầu vào
Đầu ra
Image branch
DenseNet121/ResNet50 làm baseline; Vision Transformer hoặc hybrid CNN-Transformer làm nhánh mở rộng.
Ảnh X-quang ngực chuẩn hóa; lung crop/segmentation tùy cấu hình.
Xác suất viêm phổi; embedding ảnh; heatmap giải thích.
Tabular branch
Gradient boosting hoặc MLP.
Tuổi, giới, nhịp thở, SpO2, CRP, bạch cầu, neutrophil, số ngày sốt, bệnh nền.
Risk score lâm sàng; embedding bảng.
Text branch
Biomedical encoder hoặc lightweight clinical language model.
Lý do nhập viện, mô tả nghe phổi, diễn tiến đầu, ghi chú đọc phim.
Embedding văn bản; key findings chuẩn hóa.
Fusion branch
Mid-fusion hoặc late-fusion có calibration layer.
Embedding ảnh + embedding tabular + embedding text.
Xác suất cuối cùng; uncertainty score; quyết định threshold theo use case.

4.1. Chiến lược huấn luyện và chọn mô hình
Bước 1. Huấn luyện baseline ảnh đơn thuần để thiết lập mốc so sánh kỹ thuật và mốc đối chiếu với y văn.
Bước 2. Huấn luyện mô hình bảng và mô hình văn bản riêng lẻ để đo phần giá trị tăng thêm của từng modality.
Bước 3. Huấn luyện fusion model; đánh giá trên tập nội bộ, tập calibration và tập ngoại kiểm tách biệt theo trung tâm hoặc theo thời gian.
Bước 4. Hiệu chỉnh ngưỡng theo mục tiêu sử dụng: sàng lọc ưu tiên độ nhạy cao; hỗ trợ đọc phim ưu tiên cân bằng giữa sensitivity, specificity và calibration.
Bước 5. Giữ lại tối đa 01 mô hình ứng viên chính và 01 mô hình dự phòng để thuận tiện cho kiểm định, giám sát drift và rollback.
4.2. Explainability, calibration và uncertainty
Lớp kiểm soát
Mục đích
Cách triển khai đề xuất
Explainability
Cho phép bác sỹ hiểu vùng ảnh/biến số đóng góp chính.
Grad-CAM hoặc attention map cho ảnh; feature importance/SHAP cho tabular; trích xuất câu then chốt từ text.
Calibration
Bảo đảm xác suất dự báo có ý nghĩa quyết định.
Temperature scaling hoặc isotonic regression trên tập hiệu chỉnh riêng.
Uncertainty
Nhận diện trường hợp cần giữ vai trò người đọc chính.
Confidence band, out-of-distribution flag, cảnh báo input bất thường hoặc thiếu dữ liệu.

5. LLM LAYER VÀ CƠ CHẾ KIỂM SOÁT
Nguyên tắc sử dụng. LLM không giữ vai trò mô hình chẩn đoán nguyên phát. LLM chỉ được dùng ở lớp chuẩn hóa văn bản, hỗ trợ giải thích, tóm tắt hồ sơ, truy vấn tri thức nội bộ và sinh nháp báo cáo để bác sỹ rà soát, ký duyệt.
Use case
Đầu vào
Đầu ra được phép
Kiểm soát bắt buộc
Clinical text normalization
Ghi chú bệnh án thô, mô tả khám, chỉ định chụp.
Bản tóm tắt có cấu trúc; thực thể lâm sàng chuẩn hóa.
Prompt cứng; từ điển thuật ngữ; không tự suy diễn dữ kiện thiếu.
Explanation drafting
Prediction, heatmap, feature importance, uncertainty.
Giải thích ngôn ngữ tự nhiên có dẫn bằng chứng từ pipeline.
Ràng buộc chỉ dùng evidence đã xác thực; ghi rõ đây là hỗ trợ, không phải kết luận cuối.
Report drafting
Thông tin episode, kết quả mô hình, dữ liệu lâm sàng chính.
Nháp báo cáo/hội chẩn/biểu mẫu nghiên cứu.
Bác sỹ hoặc nhóm nghiên cứu phải duyệt trước khi phát hành.
Knowledge support/RAG
Guideline, SOP, protocol, tài liệu nội bộ đã kiểm soát.
Câu trả lời có nguồn nội bộ và phiên bản tài liệu.
Kho tri thức đã chọn lọc; log truy vấn; kiểm soát quyền truy cập.

5.1. Bộ kiểm soát an toàn cho LLM
L1. Tất cả prompt hệ thống phải có rào chắn chống suy diễn, chống tiết lộ dữ liệu nhạy cảm và chống dùng thông tin ngoài nguồn được cấp phép.
L2. Mọi câu trả lời của LLM trong hệ thống phải gắn cờ nguồn sinh nội bộ, thời gian sinh và người dùng đã kích hoạt.
L3. Không cho phép LLM phát sinh chẩn đoán mới nếu pipeline dự báo nguyên phát chưa sinh ra bằng chứng tương ứng.
L4. Các đầu ra quan trọng phải qua human-in-the-loop: bác sỹ điều trị, bác sỹ chẩn đoán hình ảnh hoặc nhóm nghiên cứu được phân quyền.
6. API VÀ TÍCH HỢP PHẦN MỀM
Kiến trúc tích hợp nên theo hướng service-based để tách rời các năng lực: ingestion, preprocessing, inference, explanation, reporting và monitoring.
Endpoint/Service
Chức năng
Đầu vào chính
Đầu ra chính
POST /episodes/ingest
Tiếp nhận ảnh và dữ liệu lâm sàng của episode.
DICOM hoặc image URI; metadata; biến lâm sàng.
episode_id; trạng thái tiếp nhận; lỗi kiểm tra đầu vào.
POST /inference/pneumonia
Sinh dự báo nguy cơ/khả năng viêm phổi.
episode_id hoặc payload đã chuẩn hóa.
Probability, class label, uncertainty, model_version.
GET /inference/{episode_id}/explain
Trả heatmap và lý giải cấu trúc.
episode_id.
Explainability payload; evidence summary.
POST /reports/draft
Sinh nháp báo cáo/hội chẩn.
episode_id; template_id.
Draft report; trạng thái cần duyệt.
POST /feedback/clinician
Thu nhận phản hồi bác sỹ sau sử dụng.
episode_id; accept/reject; comment.
Feedback log; dữ liệu cho active monitoring.
GET /ops/dashboard
Cấp dữ liệu cho dashboard quản trị.
Khoảng thời gian; bộ lọc khoa/phòng.
KPI vận hành; chất lượng dữ liệu; drift signal.

7. DASHBOARD
Bảng điều khiển
Người dùng chính
Chỉ số hiển thị
Mục đích điều hành
Clinical dashboard
Bác sỹ điều trị, bác sỹ CĐHA.
Prediction, uncertainty, heatmap, mốc xét nghiệm, phản hồi bác sỹ.
Hỗ trợ đọc phim và sàng lọc ca cần ưu tiên.
Quality dashboard
Nhóm dữ liệu, QA, kỹ sư y sinh.
Độ đầy đủ dữ liệu, ảnh lỗi, missingness, label disagreement.
Phát hiện lỗi pipeline và lỗi nhập liệu.
Model dashboard
Data scientist, MLOps, hội đồng kỹ thuật.
AUC, sensitivity, specificity, calibration, drift, rollback status.
Giám sát chất lượng mô hình theo phiên bản.
Governance dashboard
Ban dự án, lãnh đạo chuyên môn, CNTT y tế.
Số ca xử lý, thời gian suy luận, uptime, tần suất sử dụng, reader concordance.
Ra quyết định mở rộng, tạm dừng hoặc hiệu chỉnh.

8. MLOPS VÀ QUẢN TRỊ VÒNG ĐỜI MÔ HÌNH
1. Thiết lập model registry chứa model artifact, training code version, dataset version, metrics, calibration artifact và tài liệu phê duyệt phát hành.
2. Pipeline CI/CD cho mô hình phải có cổng kiểm soát: kiểm tra schema dữ liệu, kiểm tra rò rỉ train-test, benchmark tối thiểu, bias/fairness review và sign-off chuyên môn.
3. Triển khai theo các trạng thái rõ ràng: research only -> validated offline -> silent mode -> pilot có giám sát -> vận hành có kiểm soát.
4. Giám sát drift gồm data drift, concept drift, performance drift và workflow drift; mỗi loại drift phải có ngưỡng cảnh báo và hành động đáp ứng.
5. Kế hoạch thay đổi mô hình phải có nguyên tắc predetermined change control nội bộ: điều kiện retrain, dữ liệu được phép dùng lại, phạm vi thay đổi và tiêu chí rollback.
6. Mọi lần suy luận trong môi trường vận hành phải được ghi audit trail gồm thời gian, model_version, input digest, output digest, người kích hoạt và phản hồi sau sử dụng.
9. HỆ KPI ĐỀ XUẤT
Lưu ý. Các ngưỡng dưới đây là mục tiêu nội bộ đề xuất cho giai đoạn pilot, dùng để điều hành dự án và không thay thế tiêu chí pháp lý hoặc tiêu chí thử nghiệm lâm sàng chính thức.
Nhóm KPI
Chỉ số
Cách hiểu
Mục tiêu nội bộ đề xuất
Tần suất theo dõi
Hiệu năng mô hình
Sensitivity ngoại kiểm
Khả năng nhận diện đúng ca viêm phổi trong tập ngoài mẫu.
>= 0,85 ở pha pilot.
Theo từng đợt ngoại kiểm.
Hiệu năng mô hình
AUC ngoại kiểm
Khả năng phân biệt tổng quát giữa ca viêm phổi và không viêm phổi.
>= 0,88 ở pha pilot.
Theo từng phiên bản mô hình.
Độ tin cậy
Calibration slope/intercept
Mức phù hợp của xác suất dự báo.
Slope gần 1; intercept gần 0.
Theo từng phiên bản mô hình.
Vận hành
Median inference latency
Thời gian từ khi episode đủ dữ liệu đến khi có kết quả.
< 5 giây với ca online tiêu chuẩn.
Hàng ngày.
Dữ liệu
Data completeness rate
Tỷ lệ episode có đủ bộ biến tối thiểu cho mô hình fusion.
>= 80%.
Hàng tuần.
An toàn
Input rejection rate
Tỷ lệ ca bị từ chối do ảnh lỗi hoặc dữ liệu không hợp lệ.
Theo dõi xu hướng; mục tiêu giảm dần theo thời gian.
Hàng tuần.
Người dùng
Clinician acceptance rate
Tỷ lệ bác sỹ chấp nhận kết quả AI như một tham chiếu hữu ích.
>= 70% trong pilot.
Hàng tháng.
Hạ tầng
Service uptime
Khả năng sẵn sàng của hệ suy luận và dashboard.
>= 99% trong giờ làm việc.
Hàng tháng.

10. RISK REGISTER
Mã
Rủi ro trọng yếu
Tác động dự kiến
Dấu hiệu nhận biết sớm
Biện pháp kiểm soát/ứng phó
R1
Dữ liệu đầu vào không đồng nhất giữa các khoa/phòng hoặc giữa các giai đoạn.
Làm giảm chất lượng mô hình, tăng drift và giảm khả năng ngoại kiểm.
Tăng missingness, tăng ảnh lỗi, giảm hiệu năng trên cohort mới.
Chuẩn hóa schema; dashboard chất lượng dữ liệu; review cohort định kỳ.
R2
Nhãn chuẩn không ổn định hoặc bất đồng giữa người đọc.
Sai lệch mục tiêu học, giảm độ tin cậy mô hình.
Tăng tỷ lệ disagreement; performance dao động thất thường.
Quy chế gán nhãn nhiều người đọc; consensus meeting; re-label cohort trọng yếu.
R3
Overfitting vào dữ liệu một trung tâm.
Hiệu năng đẹp trong nội bộ nhưng giảm mạnh ngoài mẫu.
AUC nội bộ cao nhưng ngoại kiểm giảm đáng kể.
Tách tập theo thời gian/trung tâm; external validation bắt buộc.
R4
LLM sinh nội dung vượt nguồn hoặc suy diễn quá mức.
Rủi ro an toàn thông tin và rủi ro sai lệch chuyên môn.
Xuất hiện thông tin không có trong evidence payload.
Ràng buộc prompt; RAG có kiểm soát; human review bắt buộc.
R5
Người dùng không tin tưởng hoặc không tích hợp vào workflow.
Giảm giá trị sử dụng thực tế dù mô hình có hiệu năng tốt.
Tỷ lệ mở dashboard thấp; feedback từ chối cao.
Reader study; đồng thiết kế giao diện; huấn luyện người dùng.
R6
Thiếu cơ chế rollback khi mô hình suy giảm.
Gián đoạn dịch vụ hoặc phát sinh rủi ro lâm sàng.
Drift kéo dài, khiếu nại người dùng, lỗi inference tăng.
Model registry; release gate; mô hình dự phòng; playbook rollback.
R7
Rủi ro pháp lý và quản trị dữ liệu.
Không thể mở rộng triển khai hoặc khó xin phê duyệt.
Vướng mắc IRB, phản hồi bảo mật, chưa rõ trách nhiệm.
Phân quyền, khử định danh, SOP truy cập, nhật ký kiểm toán.

11. ROADMAP TRIỂN KHAI 12-24 THÁNG
Giai đoạn
Thời gian
Công việc lõi
Đầu ra bắt buộc
Mốc quyết định
Pha 1
Tháng 1-3
Khởi động dự án, phê duyệt phạm vi, trích xuất mẫu dữ liệu, thiết kế data dictionary, SOP gán nhãn và khử định danh.
Kế hoạch dự án; data dictionary; SOP dữ liệu; cohort mẫu đầu tiên.
Go/no-go cho mở rộng trích xuất dữ liệu.
Pha 2
Tháng 4-6
Xây dựng Bronze/Silver/Gold pipeline, chuẩn hóa episode model, hoàn tất bộ nhãn pilot.
Kho dữ liệu pilot; quality dashboard; báo cáo chất lượng nhãn.
Cho phép bước vào huấn luyện baseline.
Pha 3
Tháng 7-9
Huấn luyện baseline ảnh, tabular, text và fusion; calibration; chọn mô hình ứng viên.
Benchmark report; model card; artifact registry.
Chọn 01 mô hình ứng viên chính.
Pha 4
Tháng 10-12
Ngoại kiểm ngoài mẫu, hoàn thiện API, giao diện nguyên mẫu, dashboard lâm sàng và dashboard quản trị.
Báo cáo external validation; prototype phần mềm.
Go/no-go cho silent deployment.
Pha 5
Tháng 13-18
Silent deployment, thu phản hồi bác sỹ, kiểm tra drift, tối ưu UI/UX, xây bộ prompt LLM có kiểm soát.
Báo cáo silent mode; drift report; thư viện prompt và guardrails.
Quyết định reader study/pilot sử dụng thật.
Pha 6
Tháng 19-24
Reader study, pilot có kiểm soát, chuẩn bị bản thảo công bố, hồ sơ mở rộng hoặc chuyển pha.
Kết quả reader study; bản thảo bài báo; hồ sơ tổng kết pilot.
Quyết định mở rộng quy mô, tạm dừng hoặc tái thiết kế.

12. SẢN PHẨM ĐẦU RA VÀ TIÊU CHÍ NGHIỆM THU SƠ BỘ
Nhóm sản phẩm
Đầu ra cụ thể
Tiêu chí nghiệm thu sơ bộ
Dữ liệu
Kho dữ liệu nghiên cứu đa phương thức; data dictionary; SOP gán nhãn.
Có phiên bản hóa; truy vết được; kiểm tra chất lượng dữ liệu đạt mức chấp nhận nội bộ.
Mô hình
Baseline models; fusion model; model card; calibration artifact.
Đạt ngưỡng nội bộ đề xuất; có tài liệu mô tả intended use và hạn chế.
Phần mềm
API suy luận; giao diện nguyên mẫu; dashboard vận hành.
Chạy ổn định trong môi trường pilot; có audit trail và phân quyền.
LLM layer
Prompt library; RAG nội bộ; mô-đun tóm tắt và giải thích.
Không phát sinh nội dung ngoài nguồn trong tập kiểm thử an toàn đã thiết kế.
Nghiên cứu
Báo cáo ngoại kiểm; reader study; bản thảo công bố.
Sẵn sàng nộp hội đồng khoa học, IRB hoặc tạp chí phù hợp.
Quản trị
Risk log; runbook; playbook rollback; kế hoạch change control.
Có người chịu trách nhiệm; có quy trình kích hoạt khi xảy ra sự cố.

13. KẾT LUẬN ĐỊNH HƯỚNG
Kết luận. Đề cương kỹ thuật này đặt bài toán viêm phổi Nhi khoa vào đúng logic của một hệ thống số y tế có thể triển khai: dữ liệu episode-based, mô hình đa phương thức, lớp LLM có kiểm soát, API tích hợp, dashboard điều hành, MLOps và quản trị rủi ro. Nếu được triển khai nhất quán, hệ thống không chỉ hỗ trợ chẩn đoán hình ảnh mà còn tạo nền để mở rộng sang phân tầng nguy cơ, theo dõi diễn tiến và mô hình hóa bệnh nhi theo định hướng digital twin trong giai đoạn tiếp theo.
TÀI LIỆU THAM KHẢO CHỌN LỌC
[1] Chen Y, Roberts CS, Ou W, Petigara T, Goldmacher GV, Fancourt N, et al. Deep learning for classification of pediatric chest radiographs by WHO's standardized methodology. PLoS ONE. 2021;16(6):e0253239.
[2] Singh S, Kumar M, Kumar A, Verma BK, Abhishek K, Selvarajan S, et al. Efficient pneumonia detection using Vision Transformers on chest X-rays. Scientific Reports. 2024;14:2487.
[3] Togunwa TO, Babatunde AO, Fatade OE, Olatunji R, Ogbole G, Falade A. Detection of pneumonia in children through chest radiographs using artificial intelligence in a low-resource setting: A pilot study. PLOS Digital Health. 2025;4(9):e0000713.
[4] Wang Y, Rao Y, Zhu Y, Wu J, Qiao B, Wu X, Tang Q, Xu Z, et al. Multimodal-based auxiliary diagnosis for pediatric community acquired pneumonia. Scientific Reports. 2025;15:39152.
[5] Elgammal Z, Albrijawi MT, Alhajj R. Digital twins in healthcare: a review of AI-powered practical applications across health domains. Journal of Big Data. 2025;12:234.
[6] Collins GS, Moons KGM, Dhiman P, Riley RD, Beam AL, Van Calster B, et al. TRIPOD+AI statement: updated guidance for reporting clinical prediction models that use regression or machine learning methods. BMJ. 2024;385:e078378.
[7] Liu X, Rivera SC, Moher D, Calvert MJ, Denniston AK, the SPIRIT-AI and CONSORT-AI groups. Reporting guidelines for clinical trial reports for interventions involving artificial intelligence: the CONSORT-AI extension. Nature Medicine. 2020;26:1364-1374.
[8] Rivera SC, Liu X, Chan AW, Denniston AK, Calvert MJ, the SPIRIT-AI and CONSORT-AI groups. Guidelines for clinical trial protocols for interventions involving artificial intelligence: the SPIRIT-AI extension. Nature Medicine. 2020;26:1351-1363.
[9] International Medical Device Regulators Forum. Good machine learning practice for medical device development: Guiding principles. IMDRF/AIML WG/N88 FINAL:2025.
[10] U.S. Food and Drug Administration, Health Canada, MHRA. Transparency for machine learning-enabled medical devices: Guiding principles. 2024.
[11] U.S. Food and Drug Administration, Health Canada, MHRA. Predetermined Change Control Plans for machine learning-enabled medical devices: Guiding principles. 2024.
