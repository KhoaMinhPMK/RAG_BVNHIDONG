#!/usr/bin/env python3
# Hook: flow-quality-check
# Event: subagentStop
# Mục đích: Sau khi subagent hoàn thành (mọi loại type), nếu task giống code/UI
# thì gửi followup_message yêu cầu AI kiểm tra:
# - User flow completeness (toàn bộ status pipeline)
# - Code comment chất lượng (tiếng Việt, đúng nghiệp vụ)
# - User-facing error messages
# - Consistency với design system

import sys
import json
import re

def load_input():
    try:
        return json.load(sys.stdin)
    except Exception:
        return {}

# Keywords chỉ ra task liên quan đến coding/UI
CODING_KEYWORDS = [
    r'\bcomponent\b', r'\bpage\b', r'\bui\b', r'\broute\b',
    r'\bfeature\b', r'\bfix\b', r'\brefactor\b', r'\bimpl',
    r'\bthêm\b', r'\bsửa\b', r'\btạo\b', r'\bcập\s*nhật\b',
    r'\bapi\b', r'\bhook\b', r'\bcontext\b', r'\bservice\b',
    r'\bform\b', r'\bmodal\b', r'\bdialog\b', r'\btable\b',
    r'\bdeploy\b', r'\bmigration\b', r'\bschema\b', r'\bperformance\b',
    r'\btypecheck\b', r'\bbuild\b', r'\bci\b',
]

# Keywords chỉ ra task KHÔNG cần flow review (read-only, exploration)
SKIP_KEYWORDS = [
    r'\bread\b', r'\bexplore\b', r'\bdoc\b', r'\bexplain\b',
    r'\bwhat\s+is\b', r'\bhow\s+does\b', r'\blist\b',
    r'\bđọc\b', r'\bgiải\s*thích\b',
]

FLOW_REVIEW_MESSAGE = """## ✅ Post-Task Flow Quality Check

Subagent vừa hoàn thành. Hãy kiểm tra nhanh các điểm sau trước khi kết thúc:

### 1. 📋 User Flow Completeness
Kiểm tra xem code mới có xử lý đầy đủ các trạng thái trong pipeline không:
- [ ] `pending_detection` — hiển thị đúng, user biết đang chờ AI phát hiện
- [ ] `pending_explain` — AI đang giải thích, có spinner/streaming indicator
- [ ] `pending_draft` — đang tạo báo cáo nháp, progress rõ ràng
- [ ] `pending_approval` — chờ bác sĩ ký, có action button "Phê duyệt" / "Từ chối"
- [ ] `completed` — hiển thị kết quả cuối, download/print option

Nếu component liên quan đến episode status, hãy **kiểm tra tất cả 5 states** có được handle chưa.

### 2. 💬 Code Comment Quality
Kiểm tra các comment trong code vừa tạo:
- [ ] Comment giải thích **tại sao** (why), không chỉ **cái gì** (what)
- [ ] Comment nghiệp vụ dùng tiếng Việt (ví dụ: `// Chỉ radiologist và admin mới được phê duyệt`)
- [ ] Không có comment TODO/FIXME còn sót lại chưa xử lý
- [ ] Không có code bị comment out (xoá hoặc dùng git history)
- [ ] JSDoc cho các function public/exported có đủ `@param`, `@returns`

### 3. 🔴 User-Facing Error Messages
Kiểm tra các thông báo lỗi người dùng thấy:
- [ ] Lỗi API → hiển thị message **tiếng Việt** thân thiện (không expose technical error)
- [ ] Lỗi validation → chỉ rõ field nào sai, cần nhập gì
- [ ] Lỗi timeout/network → có retry button hoặc hướng dẫn thử lại
- [ ] Lỗi permission → giải thích role cần có (không chỉ "403 Forbidden")

**Ví dụ tốt**: `"Bạn không có quyền phê duyệt báo cáo. Chỉ bác sĩ X-quang mới có thể thực hiện thao tác này."`
**Ví dụ xấu**: `"Error: Permission denied"` hoặc `"Something went wrong"`

### 4. 🎨 Design System Consistency
- [ ] Dùng Tailwind classes từ design system (không inline style)
- [ ] Dùng shadcn/ui components (`Button`, `Card`, `Dialog`...) thay vì HTML thuần
- [ ] Màu sắc trạng thái nhất quán:
  - Pending/chờ → `yellow/amber`
  - Completed → `green`  
  - Error/từ chối → `red`
  - Processing/đang xử lý → `blue`
- [ ] Spacing nhất quán với các trang khác (kiểm tra `page.tsx` cùng cấp)

### 5. 🔒 Security & Privacy (Y tế)
- [ ] Không log thông tin bệnh nhân vào console
- [ ] Data sensitive được mask nếu role không đủ quyền
- [ ] Confirm dialog trước khi xoá/huỷ báo cáo

---
**Nếu phát hiện vấn đề nào ở trên, hãy sửa ngay trước khi kết thúc task.**
"""

def should_run_review(data: dict) -> bool:
    """Quyết định có nên chạy review hay không dựa trên context của subagent."""
    # Lấy description và result từ input
    text = " ".join([
        str(data.get("description", "")),
        str(data.get("prompt", "")),
        str(data.get("task", "")),
        str(data.get("result", ""))[:500],  # chỉ lấy 500 chars đầu của result
    ]).lower()

    if not text.strip():
        return False

    # Skip nếu là read-only/exploration task
    if any(re.search(p, text, re.IGNORECASE) for p in SKIP_KEYWORDS):
        # Chỉ skip nếu không có coding keywords
        if not any(re.search(p, text, re.IGNORECASE) for p in CODING_KEYWORDS):
            return False

    # Chạy review nếu có coding keywords
    return any(re.search(p, text, re.IGNORECASE) for p in CODING_KEYWORDS)

def main():
    data = load_input()

    if not should_run_review(data):
        print(json.dumps({}))
        return

    print(json.dumps({
        "followup_message": FLOW_REVIEW_MESSAGE
    }))

if __name__ == "__main__":
    main()
