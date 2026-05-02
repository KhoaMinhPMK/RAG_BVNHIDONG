# Mẫu Template: Quy tắc làm việc nhóm — Thiết kế & Code Quality

## Cách sử dụng
- Dùng làm checklist review cho mọi dự án
- Phù hợp cho team làm việc với AI-assisted development
- Thay `[TÊN_DỰ_ÁN]` và `[TÊN_TEAM]` bằng thông tin thực tế

---

# 90% app "vibe code" trông rẻ tiền — vì sao (và cách sửa)

Bạn có thể nhận ra một app "vibe coded" chỉ trong 3 giây.
Không phải vì code kém.
Mà vì các quyết định thiết kế sai.

---

## 1. Logic chọn font

Hầu hết app vibe code dùng font mặc định của UI library — thường là Inter.
Không có gì sai với Inter… nhưng khi ai cũng dùng, app của bạn sẽ giống tất cả.

**Framework chọn font:**

| Loại app | Font gợi ý | Ghi chú |
|---|---|---|
| SaaS / công cụ năng suất | Inter, Geist | Không dùng font riêng cho heading (chỉ đổi weight) |
| App consumer | Plus Jakarta Sans, DM Sans | Tạo cảm giác thân thiện |
| Premium / tài chính / pháp lý | Sora, Neue Haas Grotesk | Nghiêm túc, đáng tin hơn |
| Landing page | Display font cho tiêu đề | Không dùng trong app |

**Nguyên tắc:** 1 font family, tối đa 2 weight. Kỷ luật chính là thiết kế.

---

## 2. Hệ thống spacing

Nếu app của bạn "có gì đó sai sai" mà không biết tại sao → thường là spacing.

**Thiết lập scale:**

```
Base: 4px
Các giá trị hợp lệ: 4, 8, 12, 16, 24, 32, 48, 64
Không dùng số lẻ: 13px, 22px, 19px...
```

Áp dụng cho margin, padding, gap một cách nhất quán.

> Nếu dùng Tailwind CSS mà spacing vẫn lộn xộn → đang override sai cách.

---

## 3. Hệ thống màu (Color Tokens)

Design system dùng semantic tokens, không phải mỗi chỗ một mã màu.

**Bộ tối thiểu:**

| Token | Mục đích |
|---|---|
| `background` | Nền trang |
| `surface` | Card, panel |
| `border` | Viền |
| `text-primary` | Nội dung chính |
| `text-secondary` | Label, caption |
| `brand-primary` | Màu chính |
| `brand-secondary` | Hover, action phụ |
| `destructive` | Error, delete |

> Define trong config, đừng hardcode hex trong component.

---

## 4. Dùng shadcn/ui đúng cách

shadcn/ui rất phù hợp cho AI-assisted development — nhưng hay bị dùng sai.

- Không customize từng component riêng lẻ → customize **design tokens**
- Không mix với library khác trong cùng view
- Dùng `cn()` thay vì nối class thủ công
- Extend variant, đừng override phá hệ thống

---

## 5. 6 quyết định thiết kế tạo khác biệt

| STT | Quyết định | Hướng dẫn |
|---|---|---|
| 1 | Border radius | Chọn 1 giá trị (8px hoặc 12px), dùng xuyên suốt |
| 2 | Shadow | Dùng để thể hiện layer, không phải trang trí |
| 3 | Icon | Chỉ dùng 1 bộ (Lucide hoặc Heroicons) |
| 4 | Input height | Đồng nhất xuyên suốt |
| 5 | Hover state | Mọi thứ clickable đều có |
| 6 | Focus state | Custom theo design, không dùng default |

---

Thiết kế không chỉ là thẩm mỹ.
Nó là tín hiệu.
Một app thiết kế tốt → cho thấy bạn quan tâm đến chi tiết.
Và người dùng tin những sản phẩm được làm bởi người có sự quan tâm đó.

> Niềm tin đó = chuyển đổi (conversion).