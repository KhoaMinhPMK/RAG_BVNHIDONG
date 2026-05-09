#!/usr/bin/env python3
# Hook: guard-auth-writes
# Event: preToolUse (matcher: Write)
# Mục đích: Cảnh báo khi AI sắp ghi vào các file security/auth quan trọng của hệ thống.
# Đảm bảo developer xem xét kỹ trước khi cho phép thay đổi middleware, RBAC, auth.

import sys
import json
import re
import os

def load_input():
    try:
        return json.load(sys.stdin)
    except Exception:
        return {}

# ── Các file cực kỳ nhạy cảm → DENY (chặn, phải sửa thủ công) ───────────────
DENY_FILE_PATTERNS = [
    (r'\.env(?:\.local|\.production|\.staging)?$', "File environment variables chứa secrets/keys"),
    (r'\.cursor/hooks\.json$', "File cấu hình Cursor hooks — tự sửa có thể vô hiệu hoá bảo vệ"),
    (r'supabase/schema\.sql$', "Schema SQL reference — thay đổi phải qua migration chính thức"),
]

# ── Các file nhạy cảm cao → ASK (yêu cầu xác nhận) ──────────────────────────
ASK_FILE_PATTERNS = [
    # Auth & middleware
    (r'apps/web/middleware\.ts$', "Next.js middleware — kiểm soát auth cho toàn bộ frontend routes"),
    (r'apps/api/src/middleware/auth\.ts$', "JWT authentication middleware — thay đổi sai sẽ mở lỗ hổng bảo mật"),
    (r'apps/api/src/middleware/rbac\.ts$', "RBAC permission matrix — kiểm soát quyền truy cập theo role"),
    (r'apps/api/src/middleware/audit\.ts$', "Audit trail middleware — đảm bảo tính truy vết hành động"),
    # Auth context trên client
    (r'apps/web/src/contexts/auth-context\.tsx?$', "Auth context — quản lý session và role trên frontend"),
    # API client (JWT attachment)
    (r'apps/web/src/lib/api/client\.ts$', "API client — nơi attach JWT token, thay đổi sai sẽ lộ token"),
    # DB schema và migration
    (r'apps/api/src/lib/supabase/.*\.ts$', "Supabase client/config — kết nối database production"),
    (r'packages/db/src/.*\.ts$', "Package database — kiểu dữ liệu DB và client Supabase"),
    # Shared Zod schemas (thay đổi có thể break validation)
    (r'packages/shared/src/.*schema.*\.ts$', "Shared Zod schema — thay đổi có thể break validation toàn hệ thống"),
    # GitHub Actions CI/CD
    (r'\.github/workflows/.*\.ya?ml$', "GitHub Actions workflow — thay đổi có thể ảnh hưởng CI/CD pipeline"),
    # CAE route (streaming AI)
    (r'apps/api/src/routes/cae\.ts$', "CAE route — streaming AI endpoint, ảnh hưởng UX chẩn đoán"),
    # Draft approval flow
    (r'apps/api/src/routes/.*draft.*\.ts$', "Draft/approval route — luồng phê duyệt báo cáo y tế"),
]

def classify_path(path: str) -> tuple[str, str]:
    """Phân loại file theo mức độ nhạy cảm."""
    if not path:
        return ("allow", "")

    # Normalize path separators
    normalized = path.replace("\\", "/")

    for pattern, reason in DENY_FILE_PATTERNS:
        if re.search(pattern, normalized, re.IGNORECASE):
            return ("deny", reason)

    for pattern, reason in ASK_FILE_PATTERNS:
        if re.search(pattern, normalized, re.IGNORECASE):
            return ("ask", reason)

    return ("allow", "")

def extract_path(data: dict) -> str:
    """Lấy đường dẫn file từ tool input."""
    tool_input = data.get("input", {})
    if isinstance(tool_input, dict):
        return tool_input.get("path", "")
    return ""

def main():
    data = load_input()
    file_path = extract_path(data)

    if not file_path:
        print(json.dumps({"permission": "allow"}))
        return

    action, reason = classify_path(file_path)

    if action == "allow":
        print(json.dumps({"permission": "allow"}))
        return

    short_path = file_path.split("/workspace/")[-1] if "/workspace/" in file_path else file_path

    if action == "deny":
        print(json.dumps({
            "permission": "deny",
            "user_message": (
                f"🚫 GHI FILE BỊ CHẶN — File này không được sửa tự động:\n\n"
                f"File: `{short_path}`\n"
                f"Lý do: {reason}\n\n"
                "File này cần được chỉnh sửa thủ công và review kỹ lưỡng. "
                "Không để AI tự động ghi vào file này."
            ),
            "agent_message": (
                f"Write bị chặn bởi guard-auth-writes hook. File: {short_path}. Lý do: {reason}"
            )
        }))
        return

    if action == "ask":
        print(json.dumps({
            "permission": "ask",
            "user_message": (
                f"⚠️  FILE NHẠY CẢM — Xác nhận trước khi ghi:\n\n"
                f"File: `{short_path}`\n"
                f"Cảnh báo: {reason}\n\n"
                "File này ảnh hưởng đến bảo mật hoặc nghiệp vụ cốt lõi của hệ thống y tế. "
                "Bạn có muốn AI ghi vào file này không? "
                "Hãy review kỹ nội dung diff trước khi đồng ý."
            ),
            "agent_message": (
                f"Người dùng được cảnh báo về việc ghi vào file nhạy cảm: {short_path}. "
                f"Lý do: {reason}"
            )
        }))
        return

if __name__ == "__main__":
    main()
