# Mẫu Template: Nhắc nhở nhóm (Ghi chú cuộc họp/chat)

## Cách sử dụng
- Copy file này làm template cho mỗi dự án mới
- Thay [TÊN_DỰ_ÁN], [TÊN_NGUỜI_REVIEW], [TÊN_NGUỒI_PHÁT_TRIỂN] bằng thông tin thực tế
- Xóa sample và thay bằng nội dung thực tế

---

## [NGÀY] — Nhắc nhở từ Lead/Reviewer

### Quy trình làm việc (Git)

1. Checkout từ nhánh chính → tạo nhánh mới cho task
2. Đặt tên nhánh theo chuẩn: `[type]/[description]` (ví dụ: `fix/button-style`, `feature/user-auth`)
3. Fix conflict trước khi merge
4. Tạo Pull Request → gửi cho reviewer
5. **Không được push trực tiếp lên nhánh chính**

### Quy tắc code

1. Không để warning trong terminal
2. Không có `console.log` trong F12 (production)
3. Không khai báo biến/hàm không sử dụng
4. Format code cho chuẩn (Prettier / ESLint)
5. Code xong → tạo PR → gửi review → **không tự merge vào nhánh chính**

---

## Ghi chú mở rộng

> Thêm các quy tắc đặc thù của dự án vào đây.
> Ví dụ: naming convention, structure folder, tech stack, deadline...