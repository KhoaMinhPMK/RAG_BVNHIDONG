#!/usr/bin/env python3
# Hook: guard-shell
# Event: beforeShellExecution
# Mục đích: Bảo vệ hệ thống khỏi các lệnh shell nguy hiểm trên dự án y tế.
# Phân loại 3 mức: DENY (chặn hoàn toàn), ASK (yêu cầu xác nhận), ALLOW (cho phép).

import sys
import json
import re
import os

def load_input():
    try:
        return json.load(sys.stdin)
    except Exception:
        return {}

# ── Các mẫu lệnh bị chặn hoàn toàn (DENY) ──────────────────────────────────
DENY_PATTERNS = [
    # Xoá/drop database, table, schema không an toàn
    (r'\bDROP\s+(TABLE|DATABASE|SCHEMA|INDEX|FUNCTION|TRIGGER)\b', "Lệnh DROP database object — có thể xoá dữ liệu y tế vĩnh viễn"),
    (r'\bTRUNCATE\s+TABLE\b', "Lệnh TRUNCATE TABLE — xoá toàn bộ dữ liệu bảng"),
    # DELETE không có WHERE clause
    (r'\bDELETE\s+FROM\s+\w+\s*;', "Lệnh DELETE không có điều kiện WHERE — xoá toàn bộ bảng"),
    (r'\bDELETE\s+FROM\s+\w+\s*$', "Lệnh DELETE không có điều kiện WHERE"),
    # Xoá thư mục quan trọng
    (r'rm\s+(-rf?|--recursive)\s+[\./]*(apps|packages|\.cursor|\.github|node_modules)', "Xoá thư mục source code hoặc cấu hình dự án"),
    (r'rm\s+(-rf?|--recursive)\s+/', "Xoá từ root filesystem — cực kỳ nguy hiểm"),
    # Force push lên main/master
    (r'git\s+push\s+.*--force(?!-with-lease).*\s+(origin\s+)?(main|master)', "Force push lên nhánh main/master không có --force-with-lease"),
    (r'git\s+push\s+-f\s+.*(main|master)', "Force push (-f) lên nhánh main/master"),
    # Ghi đè biến môi trường production
    (r'heroku\s+config:set\s+SKIP_AUTH=true', "Tắt auth trên môi trường production Heroku"),
    # Xoá migration files
    (r'rm\s+.*migration[s]?/.*\.sql', "Xoá file migration SQL — không thể khôi phục schema history"),
]

# ── Các mẫu lệnh cần xác nhận (ASK) ─────────────────────────────────────────
ASK_PATTERNS = [
    # Push thẳng lên main/master (không force)
    (r'git\s+push\s+(origin\s+)?(main|master)\b', "Push trực tiếp lên nhánh main/master (không qua PR)"),
    # Reset hard
    (r'git\s+reset\s+--hard', "Git reset --hard — mất toàn bộ uncommitted changes"),
    # DROP với điều kiện IF EXISTS (vẫn nguy hiểm)
    (r'\bDROP\s+TABLE\s+IF\s+EXISTS\b', "DROP TABLE IF EXISTS — xoá bảng, dữ liệu không khôi phục được"),
    # Lệnh seed/migrate production
    (r'yarn\s+(seed|migrate)\s*.*?(prod|production)', "Chạy seed/migrate trên môi trường production"),
    (r'npm\s+run\s+(seed|migrate)\s*.*?(prod|production)', "Chạy seed/migrate trên môi trường production"),
    # Xoá node_modules (có thể OK nhưng tốn thời gian)
    (r'rm\s+(-rf?|--recursive)\s+.*/node_modules', "Xoá node_modules — sẽ cần cài lại dependencies"),
    # Chạy script benchmark trực tiếp trên Supabase production
    (r'yarn\s+(benchmark|eval):.*\s+--env\s*(=)?\s*prod', "Chạy benchmark/eval trực tiếp trên production database"),
    # curl tới production API với method nguy hiểm
    (r'curl\s+.*(-X\s*(DELETE|PATCH|PUT))\s+.*(prod|production|api\.)', "Curl request thay đổi dữ liệu tới API production"),
    # Xoá thư mục uploads (dữ liệu ảnh X-quang)
    (r'rm\s+(-rf?|--recursive)\s+.*(upload|images|xray)', "Xoá thư mục chứa ảnh X-quang — dữ liệu y tế quan trọng"),
    # Set SKIP_AUTH=true trong env development
    (r'export\s+SKIP_AUTH=true', "Bật chế độ bypass authentication"),
    # psql với lệnh nguy hiểm
    (r'psql\s+.*-c\s+["\']?(DELETE|DROP|TRUNCATE|UPDATE)', "Thực thi lệnh SQL nguy hiểm trực tiếp qua psql"),
]

def check_command(cmd: str) -> tuple[str, str]:
    """Kiểm tra lệnh. Trả về (action, reason)."""
    if not cmd:
        return ("allow", "")

    cmd_upper = cmd.upper()

    for pattern, reason in DENY_PATTERNS:
        if re.search(pattern, cmd, re.IGNORECASE):
            return ("deny", reason)

    for pattern, reason in ASK_PATTERNS:
        if re.search(pattern, cmd, re.IGNORECASE):
            return ("ask", reason)

    return ("allow", "")

def is_dev_environment() -> bool:
    """Kiểm tra có đang ở môi trường dev không."""
    env = os.environ.get("NODE_ENV", "development")
    return env in ("development", "test", "")

def main():
    data = load_input()
    command = data.get("command", "")

    if not isinstance(command, str):
        print(json.dumps({"permission": "allow"}))
        return

    action, reason = check_command(command)

    if action == "allow":
        print(json.dumps({"permission": "allow"}))
        return

    if action == "deny":
        print(json.dumps({
            "permission": "deny",
            "user_message": (
                f"🚫 LỆNH BỊ CHẶN — Phát hiện lệnh nguy hiểm:\n\n"
                f"Lý do: {reason}\n\n"
                f"Lệnh: `{command[:200]}`\n\n"
                "Đây là hệ thống y tế chứa dữ liệu bệnh nhân. "
                "Lệnh này có thể gây mất dữ liệu vĩnh viễn. "
                "Nếu thực sự cần, hãy thực hiện thủ công trong terminal sau khi backup dữ liệu."
            ),
            "agent_message": (
                f"Shell command bị chặn bởi guard-shell hook. Lý do: {reason}. "
                f"Command: {command[:200]}"
            )
        }))
        return

    if action == "ask":
        print(json.dumps({
            "permission": "ask",
            "user_message": (
                f"⚠️  CẢNH BÁO — Lệnh này yêu cầu xác nhận:\n\n"
                f"Cảnh báo: {reason}\n\n"
                f"Lệnh: `{command[:200]}`\n\n"
                "Bạn có chắc chắn muốn tiếp tục? "
                "Hãy đảm bảo đã backup dữ liệu và hiểu rõ tác động."
            ),
            "agent_message": (
                f"Người dùng được cảnh báo về lệnh có rủi ro: {reason}. "
                f"Command: {command[:200]}"
            )
        }))
        return

if __name__ == "__main__":
    main()
