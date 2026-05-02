# The Clinical Command Blueprint: Deploying Multimodal AI for Pediatric Pneumonia
## Bản tổng hợp Markdown để đưa cho AI đọc

> Tài liệu gốc mô tả một lộ trình chiến lược 24 tháng nhằm đưa AI đa phương thức cho viêm phổi Nhi khoa đi từ giai đoạn kiểm chứng học thuật đến triển khai lâm sàng theo mô hình episode-based, có giải thích được, có kiểm định ngoài mẫu, có quản trị SPIRIT-AI, và có human-in-the-loop.

---

## 1. Tóm tắt điều hành

Tài liệu này đề xuất một kiến trúc AI đa phương thức để hỗ trợ chẩn đoán viêm phổi Nhi khoa bằng cách kết hợp đồng bộ:

- Ảnh X-quang ngực (CXR)
- Văn bản lâm sàng từ HIS/EMR
- Dữ liệu xét nghiệm/lab từ LIS

Tư tưởng cốt lõi của tài liệu là:

- Không xem bệnh nhân như một ảnh đơn lẻ
- Không xây AI theo kiểu image-only, lab-only, hoặc text-only tách rời
- Đơn vị phân tích đúng phải là **Episode ID**, tức một đợt khám/chẩn đoán có trục thời gian chung
- Mọi suy luận lâm sàng phải dựa trên sự đồng bộ dữ liệu liên hệ thống
- AI không thay thế bác sĩ mà đóng vai trò hỗ trợ, giải thích và tổng hợp bằng chứng

Tài liệu nhấn mạnh 3 trụ cột triển khai:

1. **External validation** trên dữ liệu Nhi khoa thực tế, có kiểm tra out-of-distribution
2. **Episode-based fusion** giữa CXR, clinical text và lab
3. **Explainable architecture** với GradCAM, SHAP, quy trình theo SPIRIT-AI

---

## 2. Vấn đề hiện tại và khoảng cách với thực tế lâm sàng

### 2.1. Các rủi ro của AI hiện tại khi triển khai tách rời

#### Lab-only / Benchmark-only performance
- Nhiều mô hình có độ chính xác cao trên benchmark
- Nhưng khi triển khai thật lại giảm hiệu năng do thiên lệch trung tâm đơn lẻ
- Tức là mô hình mạnh trong phòng thí nghiệm nhưng yếu khi vào bệnh viện thật

#### Single-modality blindness
- Mô hình chỉ nhìn CXR thường bỏ qua:
  - CRP
  - Bạch cầu
  - Neutrophil
  - Bối cảnh triệu chứng
  - Diễn tiến lâm sàng
- Điều này khác với thực tế bác sĩ luôn kết hợp nhiều loại thông tin trước khi kết luận

#### Opaque operations
- Mô hình kiểu black-box chỉ trả ra xác suất
- Bác sĩ không biết mô hình đang nhìn vùng nào trên ảnh
- Không biết biến lâm sàng nào đang đẩy dự đoán lên hoặc kéo xuống
- Dẫn đến khó tin tưởng và khó chấp nhận lâm sàng

### 2.2. Hướng giải quyết được đề xuất

#### External validation
- Huấn luyện trên dữ liệu Nhi khoa thực tế
- Kiểm tra nghiêm ngặt ngoài mẫu
- Chống quá khớp theo trung tâm đơn lẻ

#### Episode-based fusion
- Đồng bộ CXR, clinical text, lab theo cùng một đợt bệnh
- Mô phỏng lại đúng quy trình hội chẩn đa chuyên khoa

#### Explainable architecture
- Dùng GradCAM cho nhánh ảnh
- Dùng SHAP cho nhánh dữ liệu cấu trúc
- Đặt toàn bộ trong khung SPIRIT-AI để đảm bảo triển khai an toàn

---

## 3. Nguyên lý nền tảng: bệnh nhân là một timeline đồng bộ, không phải một ảnh

### 3.1. Mô hình dữ liệu theo episode

Tài liệu đề xuất một **Episode-Based Data Model** gồm 3 lớp đồng bộ:

#### HIS/EMR Ingestion
Trích xuất văn bản không cấu trúc, ví dụ:
- Tuổi
- Thời gian sốt
- Nghe phổi
- Các mô tả lâm sàng liên quan

#### LIS Synchronization
Đồng bộ xét nghiệm theo đúng thời điểm chụp X-quang:
- CRP
- Leukocyte
- Neutrophil
- Các chỉ số cận lâm sàng khác

#### PACS Integration
Kéo ảnh DICOM gốc từ PACS và chuẩn hóa:
- Chuẩn hóa ảnh về 512x512
- Bảo đảm pipeline ảnh nhất quán

### 3.2. Nguyên tắc cốt lõi

**Atomic unit of data = Episode ID, not Image ID**

Nghĩa là:
- Một ảnh đơn lẻ không đủ đại diện cho quyết định lâm sàng
- Dữ liệu đúng phải là một đợt bệnh/đợt khám có bối cảnh
- Mọi prediction phải dựa trên sự đồng bộ đa hệ thống

---

## 4. Vì sao mô hình đa phương thức tốt hơn mô hình chỉ đọc ảnh

Tài liệu so sánh hai hướng:

### 4.1. Single-modality AI: CXR only
Hạn chế:
- Tỉ lệ false positive cao ở các biểu hiện không điển hình
- Không mô phỏng được quy trình ra quyết định của bác sĩ
- Dễ vỡ khi thay đổi tư thế chụp, thiết bị hoặc phân phối dữ liệu
- Dễ vi phạm yêu cầu SPIRIT-AI về xử lý input không hoàn chỉnh

### 4.2. Multimodal AI: CXR + Clinical Text + Labs
Ưu điểm:
- Tăng specificity nhờ đối chiếu dấu hiệu hình ảnh với chỉ điểm viêm như CRP
- Phản ánh đúng quá trình hội chẩn đa chuyên khoa
- Resilient hơn khi một modality bị nhiễu hoặc bị thiếu
- Khi một nhánh yếu, các nhánh còn lại vẫn có thể “neo” dự đoán

### 4.3. Kết luận
Mô hình đa phương thức:
- không chỉ mạnh hơn về chỉ số
- mà còn sát với thực hành lâm sàng hơn
- và phù hợp hơn cho triển khai thật

---

## 5. Bằng chứng thực nghiệm được nêu trong tài liệu

Tài liệu đưa ra một ví dụ so sánh hiệu năng giữa:

- Baseline image-only (ResNet / DenseNet): 88.0%
- Advanced image-only (Vision Transformer): 97.61%
- Proposed multimodal fusion:
  - 94.2% accuracy
  - 0.979 AUC
  - F1-score 0.943 trên dữ liệu thực tế 1,590 ca Nhi khoa biến thiên cao, tuổi 0–13

Ý nghĩa tác giả muốn truyền tải:
- Đa phương thức cho thấy tính khái quát tốt trên dữ liệu thực
- Mạnh hơn image-only ở năng lực generalization
- Có giá trị lâm sàng hơn là chỉ theo đuổi benchmark trên ảnh

> Nguồn được slide ghi chú là Wang et al., 2025 và Singh et al., 2024 validation benchmarks.

---

## 6. Kiến trúc đề xuất: Tri-Branch Fusion Engine

Tài liệu đề xuất một mô hình 3 nhánh:

### 6.1. Nhánh ảnh CXR
- Backbone: Modified ResNet-50 hoặc ViT
- Ảnh đầu vào: 512x512
- Augmentation: random scaling / rotation
- Đầu ra: vector 128 chiều

### 6.2. Nhánh tabular
- DNN xử lý 8 chỉ số xét nghiệm/lab
- Đầu ra: vector 32 chiều

### 6.3. Nhánh text
- Dùng Bidirectional GRU
- Ánh xạ 642 symptom tokens duy nhất
- Đầu ra: vector 32 chiều

### 6.4. Fusion layer
- Ghép 3 vector:
  - 128 chiều từ ảnh
  - 32 chiều từ tabular
  - 32 chiều từ text
- Tổng: 178 chiều
- Đầu ra cuối: xác suất Community-Acquired Pneumonia (CAP probability)

### 6.5. Ý nghĩa của kiến trúc
- Ảnh cung cấp bằng chứng hình thái học
- Tabular cung cấp dấu hiệu viêm khách quan
- Text cung cấp bối cảnh triệu chứng và khám bệnh
- Fusion layer tổng hợp 3 nguồn bằng chứng thành một dự đoán thống nhất

---

## 7. Explainability: chẩn đoán minh bạch, không mù mờ

### 7.1. Giải thích trên ảnh
- Dùng GradCAM để hiển thị vùng tổn thương nổi bật trên CXR
- Ví dụ slide minh họa vùng opacity đậm được mô hình tập trung chú ý
- Mục tiêu:
  - để bác sĩ nhìn thấy mô hình đang “nhìn vào đâu”
  - để xác nhận vùng chú ý có phù hợp với chuẩn đọc phim hay không

### 7.2. Giải thích trên dữ liệu cấu trúc
- Dùng SHAP Summary Plot
- Ví dụ trong slide:
  - CRP cao làm tăng xác suất chẩn đoán
  - Monocyte cao cũng đẩy xác suất lên
  - Basophil bình thường có xu hướng kéo xác suất xuống

### 7.3. Vai trò của explainability
- Ngăn blind trust
- Không để AI chỉ trả ra một con số vô nghĩa
- Giúp mô hình đáp ứng yêu cầu SPIRIT-AI về khả năng diễn giải

---

## 8. Clinical Twin: mô hình như một bản sao hỗ trợ hội chẩn

Tài liệu mô tả một giao diện tổng hợp lâm sàng gọi là **Episode-Based Clinical Twin**

Thành phần:
- Phân tích CXR kèm GradCAM overlay
- Structured clinical notes
- Laboratory DNN output
- Fusion probability score
- Cờ bất định (uncertainty flag)

Ví dụ hiển thị:
- Fusion probability score: 88.5%
- Có cảnh báo:
  - “Human override recommended”

Ý nghĩa:
- Hệ thống không thay bác sĩ
- Hệ thống tổng hợp các nhánh bằng chứng và hiển thị kết quả hành động được
- Nếu độ bất định cao, bác sĩ phải được khuyến nghị override / review thủ công

Tài liệu khẳng định:
- Clinical Twin mô phỏng quy trình hội chẩn đa chuyên khoa
- Cho ra gói thông tin chẩn đoán tổng hợp trong dưới 5 giây

---

## 9. Vai trò của LLM: bị giới hạn nghiêm ngặt, không được chẩn đoán tự do

Tài liệu không cho LLM làm lõi suy luận y khoa.
LLM chỉ được phép hoạt động trong một khung kiểm soát xác định.

### 9.1. Luồng kiểm soát LLM

Raw Clinical Text Input  
->  
L1 Prompt Constraints  
->  
L2 Provenance Tracking  
->  
L3 Semantic Containment  
->  
L4 Human-in-the-Loop  
->  
Safe Structured Clinical Draft

### 9.2. 4 lớp rào chắn

#### L1. Prompt Constraints
- Hard-coded rules
- Chặn rò rỉ dữ liệu
- Chặn tổng hợp tri thức ngoài phạm vi dữ liệu được cấp

#### L2. Provenance Tracking
- Văn bản sinh ra phải truy được nguồn
- Mọi câu sinh ra phải neo trực tiếp vào evidence payload từ RAG/fusion pipeline

#### L3. Semantic Containment
- Cấm tuyệt đối việc LLM tự tạo ra chẩn đoán mới
- Chỉ được diễn giải những gì đã được engine 3 nhánh tạo ra

#### L4. Human-in-the-Loop
- Bác sĩ bắt buộc phải review và sign-off
- Không được đẩy bản nháp vào EMR nếu chưa có phê duyệt của con người

### 9.3. Kết luận
LLM trong hệ này chỉ là:
- công cụ tóm tắt an toàn
- công cụ soạn nháp có nguồn gốc
- không phải công cụ tự chẩn đoán

---

## 10. Tích hợp đạo đức và workflow theo SPIRIT-AI

Tài liệu xây quy trình 5 bước:

### 10.1. Input Data Assessment
Theo SPIRIT-AI 10 và 11a-i/iii

Mục tiêu:
- kiểm tra chất lượng input DICOM và lab
- loại dữ liệu mờ, thiếu, hoặc lỗi

### 10.2. Fusion Inference
- Mô hình sinh ra xác suất chẩn đoán
- Đồng thời sinh ra payload explainability

### 10.3. LLM Draft Generation
Theo SPIRIT-AI 11a-v

- Chỉ tóm tắt an toàn từ bằng chứng đã có
- Không được tự phát minh nội dung

### 10.4. Mandatory Clinician Review
Theo SPIRIT-AI 11a-vi

- Bác sĩ xem:
  - GradCAM
  - SHAP
  - bản nháp
- Sau đó mới quyết định có chấp nhận hay chỉnh sửa

### 10.5. Final Clinical Decision
- Bác sĩ có quyền:
  - accept
  - modify
  - reject
- Hệ thống thu feedback để theo dõi model drift

### 10.6. Ý nghĩa
- Quyết định cuối cùng luôn thuộc về con người
- AI là lớp hỗ trợ có kiểm soát
- Toàn bộ hệ thống được thiết kế để phù hợp với nghiên cứu và triển khai có trách nhiệm

---

## 11. Nền tảng dữ liệu theo 4 lớp: Bronze -> Silver -> Gold -> Serving

Tài liệu đưa ra một data foundation version-controlled rất rõ ràng.

### 11.1. Bronze Zone (Raw)
- Gần nguyên trạng dữ liệu gốc
- Chứa:
  - DICOM dumps
  - raw HIS logs
- Chế độ:
  - read-only
  - hash-checked để kiểm soát integrity

### 11.2. Silver Zone (Standardized)
- De-identification
- Unit mapping
- Missingness logging
- Image resizing về 512x512

### 11.3. Gold Zone (Training-Ready)
- Consensus labels từ nhiều người đọc
- Ít nhất 2 independent readers
- Cohort versioning
- Balanced episode tables

### 11.4. Serving Zone (Clinical Production)
- Feature store có RBAC protection
- Hỗ trợ real-time inference
- Có full audit trails

### 11.5. Ý nghĩa
- Dữ liệu phải đi từ thô đến chuẩn hóa, rồi mới thành dữ liệu sẵn sàng huấn luyện
- Dataset dùng train và hệ chạy lâm sàng phải có truy vết đầy đủ
- Hệ này phù hợp cho môi trường y tế có yêu cầu quản trị cao

---

## 12. MLOps và quản trị vòng đời toàn hệ thống

Tài liệu xác định 4 dashboard cho 4 nhóm người dùng khác nhau.

### 12.1. Clinical Dashboard
**User:** Physician

Theo dõi:
- Prediction scores
- Uncertainty metrics
- XAI heatmaps
- Feedback toggles

### 12.2. Quality Dashboard
**User:** Data Engineers

Theo dõi:
- Missingness
- Label disagreement
- Input rejection rates

### 12.3. Model Dashboard
**User:** Data Scientists

Theo dõi:
- AUC
- Calibration
- Drift:
  - data drift
  - concept drift
  - performance drift

### 12.4. Governance Dashboard
**User:** Hospital Leadership

Theo dõi:
- ROI
- Inference latency
- System uptime
- Clinician acceptance rates

### 12.5. Ý nghĩa
Hệ AI không chỉ là mô hình.
Nó là một sản phẩm lâm sàng phải có:
- giám sát dữ liệu
- giám sát hiệu năng
- giám sát vận hành
- giám sát chấp nhận lâm sàng
- giám sát lợi ích tổ chức

---

## 13. Các rủi ro dự kiến và chiến lược giảm thiểu

### 13.1. Overfitting to single-center data
**Rủi ro**
- Mô hình học quá sát một trung tâm

**Giảm thiểu**
- Bắt buộc có external validation
- Tách train theo không gian/thời gian chặt chẽ

### 13.2. Label instability and reader disagreement
**Rủi ro**
- Bác sĩ đọc phim không thống nhất
- Nhãn không ổn định

**Giảm thiểu**
- Two-tier reference standard:
  - Image + Clinical composite
- Consensus meeting cho các ca khó

### 13.3. Clinician rejection / workflow disruption
**Rủi ro**
- Bác sĩ không chấp nhận
- Hệ AI làm gián đoạn quy trình làm việc

**Giảm thiểu**
- Reader studies quy mô đủ lớn
- Co-design UI với bác sĩ Nhi
- Chỉ cho AI ở vai trò hỗ trợ có giải thích

### 13.4. Undetected model degradation
**Rủi ro**
- Hiệu năng giảm theo thời gian mà không ai phát hiện

**Giảm thiểu**
- Pre-determined change control plans (PCCP)
- Drift alerts
- Automated rollback playbooks

---

## 14. Lộ trình triển khai 24 tháng

### Phase 1–2: Data Foundation (Tháng 1–6)
Mục tiêu:
- IRB approval
- SOP creation
- Thiết lập pipeline Bronze / Silver / Gold

Go / No-Go gate

### Phase 3: Model Engineering (Tháng 7–9)
Mục tiêu:
- Huấn luyện các baseline:
  - image-only
  - tabular-only
  - text-only
- Chọn ứng viên fusion tối ưu

Go / No-Go gate

### Phase 4: External Validation (Tháng 10–12)
Mục tiêu:
- Testing ngoài mẫu
- Chốt prototype UI lâm sàng

Go / No-Go gate

### Phase 5: Silent Deployment (Tháng 13–18)
Mục tiêu:
- Chạy nền trên dữ liệu thật
- Không hiển thị kết quả cho bác sĩ
- Theo dõi drift theo thời gian thực

Go / No-Go gate

### Phase 6: Clinical Pilot (Tháng 19–24)
Mục tiêu:
- Reader studies
- Controlled human-in-the-loop deployment
- Regulatory dossier preparation

Go / No-Go gate

### Ý nghĩa của roadmap
- Không nhảy thẳng từ mô hình sang triển khai thật
- Phải đi qua:
  - chuẩn hóa dữ liệu
  - baseline
  - fusion
  - ngoại kiểm
  - silent deployment
  - pilot lâm sàng
- Mỗi pha đều có cổng quyết định tiếp tục hay dừng

---

## 15. Các nguyên tắc thiết kế hệ thống được tài liệu ngầm khẳng định

### 15.1. AI phải bám workflow lâm sàng
Không thiết kế theo logic benchmark đơn thuần.

### 15.2. Đa phương thức là mặc định
Không coi ảnh là nguồn chân lý duy nhất.

### 15.3. Explainability là bắt buộc
Không chấp nhận black-box trong môi trường bệnh viện.

### 15.4. Human-in-the-loop là bất khả xâm phạm
Quyền quyết định cuối cùng luôn thuộc bác sĩ.

### 15.5. Dữ liệu phải có versioning và auditability
Không chỉ quan tâm train model mà bỏ qua quản trị dữ liệu.

### 15.6. MLOps trong y tế phải bao gồm governance
Không chỉ theo dõi loss/AUC, mà phải theo dõi:
- chấp nhận lâm sàng
- ROI
- uptime
- latency
- drift
- phản hồi người dùng

---

## 16. Cách hiểu ngắn gọn toàn bộ blueprint

Đây là một bản thiết kế cho hệ AI hỗ trợ chẩn đoán viêm phổi Nhi khoa có các đặc điểm:

- lấy **episode** làm đơn vị trung tâm
- kết hợp **CXR + lab + clinical text**
- dùng **fusion** để tạo xác suất chẩn đoán
- bắt buộc có **explainability**
- dùng **LLM rất hạn chế**, chỉ để tóm tắt an toàn có nguồn gốc
- luôn có **bác sĩ review**
- triển khai theo chuẩn **SPIRIT-AI**
- quản trị theo vòng đời đầy đủ từ dữ liệu đến dashboard, drift và pilot lâm sàng

---

## 17. Phiên bản ultra-short cho AI đọc nhanh

### Objective
Build a clinically deployable multimodal AI system for pediatric pneumonia using synchronized chest X-ray, structured labs, and clinical text.

### Core thesis
The correct unit of prediction is the **clinical episode**, not the isolated image.

### Inputs
- PACS / DICOM chest X-ray
- HIS / EMR clinical text
- LIS laboratory values

### Architecture
- Image branch: ResNet-50 or ViT -> 128-d vector
- Tabular branch: DNN -> 32-d vector
- Text branch: Bi-GRU -> 32-d vector
- Fusion layer -> CAP probability

### Explainability
- GradCAM for image
- SHAP for tabular
- Evidence-grounded clinical summary

### LLM policy
- Only draft generation
- No autonomous diagnosis
- Must be source-grounded
- Must be clinician-reviewed

### Governance
- Bronze / Silver / Gold / Serving data layers
- Clinical / Quality / Model / Governance dashboards
- Drift monitoring and rollback plans

### Deployment roadmap
1. Data foundation
2. Baselines + fusion candidate selection
3. External validation
4. Silent deployment
5. Clinical pilot

### Final principle
AI augments the physician; it does not replace the physician.

---

## 18. Gợi ý dùng tài liệu này làm prompt nền cho AI khác

Nếu dùng tài liệu này làm context cho AI khác, nên xem đây là:
- blueprint chiến lược triển khai
- guideline thiết kế kiến trúc
- guideline governance
- guideline clinical workflow
- guideline explainability and safety

Không nên xem đây là:
- một protocol hoàn chỉnh đủ để nộp IRB ngay
- một kiến trúc đã được chứng minh universally
- một tài liệu thay thế cho data dictionary, labeling SOP, hay statistical analysis plan

---