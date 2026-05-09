#!/usr/bin/env python3
# Hook: ux-component-review
# Event: afterFileEdit (matcher: Write, trên file .tsx)
# Mục đích: Sau khi AI ghi file React component (.tsx), tự động phân tích static
# code để phát hiện thiếu sót UX phổ biến trong hệ thống y tế nhi khoa:
# loading states, error handling, accessibility, i18n tiếng Việt, responsive.

import sys
import json
import os
import re
from typing import Optional

def load_input():
    try:
        return json.load(sys.stdin)
    except Exception:
        return {}

def extract_path(data: dict) -> str:
    tool_input = data.get("input", {})
    if isinstance(tool_input, dict):
        return tool_input.get("path", "")
    return ""

def read_file_content(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception:
        return ""

def is_tsx_component(path: str) -> bool:
    if not path.endswith(".tsx"):
        return False
    skip = ["/node_modules/", "/.next/", "/dist/", "/.yarn/", ".test.tsx", ".spec.tsx", "/__tests__/"]
    return not any(s in path for s in skip)

# ── Kiểm tra UX patterns ─────────────────────────────────────────────────────

def check_loading_state(content: str) -> list[str]:
    issues = []
    # Component dùng async data (useEffect/fetch/SWR) nhưng không có loading state
    has_async = bool(re.search(r'useEffect|useSWR|useQuery|fetch\(|axios\.', content))
    has_loading = bool(re.search(r'isLoading|loading|isFetching|isPending|Skeleton|Spinner|LoadingSpinner|\.loading', content, re.IGNORECASE))

    if has_async and not has_loading:
        issues.append("⚠️  **Loading state**: Component có async data nhưng thiếu loading indicator (isLoading/Skeleton/Spinner)")

    # Kiểm tra button submit thiếu disabled khi loading
    has_submit_btn = bool(re.search(r'<[Bb]utton[^>]*(?:type=["\']submit["\']|onClick)[^>]*>', content))
    has_disabled_loading = bool(re.search(r'disabled=\{.*(?:isLoading|loading|isPending|isSubmitting)', content))
    if has_submit_btn and has_async and not has_disabled_loading:
        issues.append("⚠️  **Button loading**: Button submit nên có `disabled={isLoading}` để tránh double-submit")

    return issues

def check_error_handling(content: str) -> list[str]:
    issues = []
    has_async = bool(re.search(r'useEffect|useSWR|useQuery|fetch\(|axios\.', content))
    has_error = bool(re.search(r'error|Error|catch|onError|isError|\.error', content, re.IGNORECASE))

    if has_async and not has_error:
        issues.append("⚠️  **Error handling**: Component có async data nhưng không xử lý error state")

    # Kiểm tra toast/notification cho user
    has_user_feedback = bool(re.search(r'toast|alert|notification|Snackbar|sonner|useToast', content, re.IGNORECASE))
    if has_async and not has_user_feedback:
        issues.append("ℹ️  **User feedback**: Cân nhắc thêm toast/notification khi có lỗi API")

    return issues

def check_accessibility(content: str) -> list[str]:
    issues = []

    # Kiểm tra img thiếu alt
    img_tags = re.findall(r'<img\s[^>]*>', content)
    for img in img_tags:
        if 'alt=' not in img:
            issues.append("⚠️  **Accessibility**: Thẻ `<img>` thiếu thuộc tính `alt`")
            break

    # Kiểm tra button không có text (icon-only button)
    icon_only_btns = re.findall(r'<[Bb]utton[^>]*>(?:\s*<[A-Z][a-zA-Z]*\s*/?>?\s*)*</[Bb]utton>', content)
    for btn in icon_only_btns:
        if not re.search(r'aria-label|aria-labelledby|title=', btn):
            issues.append("⚠️  **Accessibility**: Button icon-only cần `aria-label` để screen reader đọc được")
            break

    # Kiểm tra form thiếu label
    input_count = len(re.findall(r'<(?:Input|input|textarea|select)\s', content))
    label_count = len(re.findall(r'<(?:Label|label|FormLabel)\s|htmlFor=|aria-label=', content))
    if input_count > 0 and label_count == 0:
        issues.append("⚠️  **Accessibility**: Form inputs cần `<Label>` hoặc `aria-label` (quan trọng cho môi trường y tế)")

    # Kiểm tra color-only indicators (y tế cần không dùng màu đơn thuần)
    has_status_color = bool(re.search(r'(?:text|bg|border)-(red|green|yellow|orange)-\d{3}', content))
    has_status_text = bool(re.search(r'(?:aria-|role=|sr-only|VisuallyHidden)', content))
    if has_status_color and not has_status_text:
        issues.append("ℹ️  **Accessibility**: Trạng thái y tế không nên chỉ phân biệt bằng màu (thêm icon + text cho rõ nghĩa)")

    return issues

def check_i18n_vietnamese(content: str) -> list[str]:
    issues = []

    # Phát hiện hardcoded tiếng Anh trong JSX (không phải trong comment, import, type)
    # Tìm string literals trong JSX content
    jsx_strings = re.findall(r'>["\s]*([A-Z][a-z]+(?:\s+[a-zA-Z]+){1,5})["\s]*<', content)
    english_ui_strings = [
        s for s in jsx_strings
        if re.match(r'^[A-Za-z\s]+$', s) and len(s) > 5
        and not any(kw in s for kw in ['className', 'id=', 'key=', 'aria', 'data-'])
    ]

    if english_ui_strings[:3]:
        examples = ", ".join(f'"{s}"' for s in english_ui_strings[:3])
        issues.append(
            f"ℹ️  **i18n**: Có thể có text tiếng Anh hardcoded trong JSX: {examples}. "
            "Hệ thống dùng `next-intl` — cân nhắc dùng `useTranslations()`"
        )

    # Kiểm tra date/time formatting (y tế cần format rõ ràng)
    has_date_display = bool(re.search(r'\.toLocaleDateString|\.toLocaleString|new Date\(', content))
    has_locale_format = bool(re.search(r'locale.*vi|vi.*locale|format.*date|date-fns|dayjs|moment', content, re.IGNORECASE))
    if has_date_display and not has_locale_format:
        issues.append(
            "ℹ️  **i18n Date**: Có hiển thị date — nên format với `locale: 'vi-VN'` "
            "cho hệ thống y tế Việt Nam (ví dụ: `new Date().toLocaleDateString('vi-VN')`)"
        )

    return issues

def check_medical_ux_patterns(content: str) -> list[str]:
    """Kiểm tra các pattern UX đặc thù của hệ thống y tế."""
    issues = []

    # Kiểm tra confirm dialog trước actions nguy hiểm
    has_delete_action = bool(re.search(r'onDelete|handleDelete|deleteEpisode|deleteDraft', content))
    has_confirm = bool(re.search(r'confirm|Dialog|Modal|AlertDialog|window\.confirm', content, re.IGNORECASE))
    if has_delete_action and not has_confirm:
        issues.append(
            "⚠️  **Medical UX**: Action xoá/huỷ cần có confirmation dialog "
            "(dữ liệu bệnh án không thể khôi phục)"
        )

    # Kiểm tra approval action có audit context
    has_approval = bool(re.search(r'approve|approveDraft|handleApprove|signReport', content, re.IGNORECASE))
    has_reason = bool(re.search(r'reason|comment|note|ghi chú|lý do', content, re.IGNORECASE))
    if has_approval and not has_reason:
        issues.append(
            "ℹ️  **Medical UX**: Chức năng phê duyệt nên có trường 'Ghi chú/Lý do' "
            "để audit trail (yêu cầu nghiệp vụ bệnh viện)"
        )

    # Status badge phải rõ ràng và có tooltip
    has_status_badge = bool(re.search(r'StatusBadge|status.*badge|badge.*status|EpisodeStatus', content, re.IGNORECASE))
    has_tooltip = bool(re.search(r'Tooltip|title=|aria-describedby', content, re.IGNORECASE))
    if has_status_badge and not has_tooltip:
        issues.append(
            "ℹ️  **Medical UX**: Status badge nên có tooltip giải thích ý nghĩa "
            "(ví dụ: 'Chờ phê duyệt — Bác sĩ chưa ký')"
        )

    # Sensitive data display
    has_patient_data = bool(re.search(r'patientName|patient_name|bệnh\s*nhân|fullName|dateOfBirth', content, re.IGNORECASE))
    has_data_masking = bool(re.search(r'mask|blur|redact|sensitive|role.*admin|isAdmin', content, re.IGNORECASE))
    if has_patient_data and not has_data_masking:
        issues.append(
            "⚠️  **Medical UX**: Hiển thị dữ liệu bệnh nhân — cân nhắc phân quyền xem "
            "theo role (researcher không nên thấy tên đầy đủ)"
        )

    return issues

def check_responsive_design(content: str) -> list[str]:
    issues = []

    # Kiểm tra table thiếu responsive wrapper
    has_table = bool(re.search(r'<[Tt]able|<TableHeader|DataTable', content))
    has_overflow = bool(re.search(r'overflow-x|overflow-auto|overflow-scroll|ScrollArea', content))
    if has_table and not has_overflow:
        issues.append(
            "ℹ️  **Responsive**: Table nên có `overflow-x-auto` wrapper "
            "(bác sĩ có thể dùng tablet/iPad trong phòng bệnh)"
        )

    # Kiểm tra fixed pixel widths (antipattern cho responsive)
    fixed_widths = re.findall(r'(?:width|w)=["\']\d+px["\']|style=.*width:\s*\d+px', content)
    if len(fixed_widths) > 3:
        issues.append(
            f"ℹ️  **Responsive**: Có {len(fixed_widths)} chỗ dùng fixed pixel width — "
            "dùng Tailwind responsive classes (`w-full`, `md:w-1/2`...) thay thế"
        )

    return issues

def generate_report(path: str, content: str) -> Optional[str]:
    """Tạo báo cáo UX review."""
    all_issues: list[str] = []

    all_issues.extend(check_loading_state(content))
    all_issues.extend(check_error_handling(content))
    all_issues.extend(check_accessibility(content))
    all_issues.extend(check_i18n_vietnamese(content))
    all_issues.extend(check_medical_ux_patterns(content))
    all_issues.extend(check_responsive_design(content))

    if not all_issues:
        return None

    short_path = path.split("/workspace/")[-1] if "/workspace/" in path else os.path.basename(path)
    lines_count = content.count("\n")

    report = (
        f"## 🎨 UX Review: `{short_path}` ({lines_count} dòng)\n\n"
        + "\n\n".join(all_issues)
        + "\n\n---\n_Đây là review tự động — ưu tiên sửa các mục ⚠️ trước, ℹ️ là gợi ý cải thiện._"
    )
    return report

def main():
    data = load_input()
    file_path = extract_path(data)

    if not is_tsx_component(file_path):
        print(json.dumps({}))
        return

    content = read_file_content(file_path)
    if not content or len(content) < 50:
        print(json.dumps({}))
        return

    report = generate_report(file_path, content)
    if not report:
        print(json.dumps({"additional_context": f"✅ UX Review `{os.path.basename(file_path)}`: Không phát hiện vấn đề UX nào."}))
        return

    print(json.dumps({"additional_context": report}))

if __name__ == "__main__":
    main()
