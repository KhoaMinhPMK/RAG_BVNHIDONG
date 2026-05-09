#!/usr/bin/env python3
# Hook: guard-supabase-mcp
# Event: beforeMCPExecution
# Mục đích: Kiểm soát các MCP tool calls tới Supabase.
# Chặn hoặc yêu cầu xác nhận với các operations phá huỷ dữ liệu (apply_migration,
# execute_sql với DROP/DELETE/TRUNCATE) hoặc thay đổi schema production.

import sys
import json
import re

def load_input():
    try:
        return json.load(sys.stdin)
    except Exception:
        return {}

# ── MCP tool names nguy hiểm → DENY ─────────────────────────────────────────
# Tools này sẽ bị chặn hoàn toàn nếu không có xác nhận rõ ràng
DENY_TOOLS = {
    # apply_migration: chạy SQL migration trực tiếp — không rollback được
    # Ta không chặn hoàn toàn mà kiểm tra nội dung SQL
}

# ── Các tool cần kiểm tra nội dung → phân tích SQL ──────────────────────────
SQL_ANALYSIS_TOOLS = {
    "apply_migration",
    "execute_sql",
    "run_sql",
}

# SQL patterns nguy hiểm trong migration/query
DENY_SQL_PATTERNS = [
    (r'\bDROP\s+TABLE\b(?!\s+IF\s+EXISTS)', "DROP TABLE không có IF EXISTS — xoá bảng vĩnh viễn"),
    (r'\bDROP\s+SCHEMA\b', "DROP SCHEMA — xoá toàn bộ schema database"),
    (r'\bDROP\s+DATABASE\b', "DROP DATABASE — xoá toàn bộ database"),
    (r'\bTRUNCATE\b', "TRUNCATE — xoá toàn bộ dữ liệu bảng"),
    (r'\bDELETE\s+FROM\s+\w+\s*(?:;|$)(?!\s*WHERE)', "DELETE không có WHERE clause — xoá toàn bộ bảng"),
]

ASK_SQL_PATTERNS = [
    (r'\bDROP\s+TABLE\s+IF\s+EXISTS\b', "DROP TABLE IF EXISTS — xoá bảng nếu tồn tại"),
    (r'\bALTER\s+TABLE\b', "ALTER TABLE — thay đổi cấu trúc bảng (có thể ảnh hưởng dữ liệu hiện có)"),
    (r'\bDROP\s+COLUMN\b', "DROP COLUMN — xoá cột và toàn bộ dữ liệu trong cột đó"),
    (r'\bUPDATE\s+\w+\s+SET\b(?!.*WHERE)', "UPDATE không có WHERE — cập nhật toàn bộ bảng"),
    (r'\bDROP\s+INDEX\b', "DROP INDEX — xoá index có thể ảnh hưởng hiệu năng query"),
    (r'\bDROP\s+FUNCTION\b', "DROP FUNCTION — xoá stored function"),
    (r'\bDROP\s+TRIGGER\b', "DROP TRIGGER — xoá trigger (audit/automation)"),
    # Tắt RLS
    (r'\bALTER\s+TABLE\s+\w+\s+DISABLE\s+ROW\s+LEVEL\s+SECURITY\b', "Tắt Row Level Security — mở quyền truy cập toàn bộ bảng"),
    (r'\bDROP\s+POLICY\b', "DROP POLICY — xoá RLS policy"),
]

# ── MCP tools cần xác nhận theo tên ─────────────────────────────────────────
ASK_TOOLS = {
    "delete_storage_object": "Xoá file storage Supabase (ảnh X-quang, tài liệu y tế)",
    "delete_storage_bucket": "Xoá toàn bộ storage bucket",
}

# ── MCP tools cần inject thêm context ────────────────────────────────────────
CONTEXT_TOOLS = {
    "list_tables": "Liệt kê bảng Supabase — cung cấp thêm ngữ cảnh schema",
    "get_logs": "Lấy logs Supabase — hữu ích để debug",
}

def analyze_sql(sql: str) -> tuple[str, str]:
    """Phân tích SQL và trả về (action, reason)."""
    if not sql:
        return ("allow", "")

    for pattern, reason in DENY_SQL_PATTERNS:
        if re.search(pattern, sql, re.IGNORECASE | re.MULTILINE):
            return ("deny", reason)

    for pattern, reason in ASK_SQL_PATTERNS:
        if re.search(pattern, sql, re.IGNORECASE | re.MULTILINE):
            return ("ask", reason)

    return ("allow", "")

def extract_sql_from_args(tool_name: str, arguments: dict) -> str:
    """Lấy SQL string từ arguments của tool."""
    sql_fields = ["query", "sql", "migration_sql", "content"]
    for field in sql_fields:
        val = arguments.get(field, "")
        if isinstance(val, str) and val.strip():
            return val
    return ""

def main():
    data = load_input()
    tool_name = data.get("tool_name", "") or data.get("name", "")
    arguments = data.get("arguments", {})
    server_name = data.get("server_name", "") or data.get("server", "")

    if not isinstance(arguments, dict):
        arguments = {}

    # Chỉ xử lý Supabase MCP calls
    if "supabase" not in server_name.lower():
        print(json.dumps({"permission": "allow"}))
        return

    # Kiểm tra tool theo tên trực tiếp (ASK)
    if tool_name in ASK_TOOLS:
        reason = ASK_TOOLS[tool_name]
        obj_id = arguments.get("object_name") or arguments.get("bucket_id") or ""
        print(json.dumps({
            "permission": "ask",
            "user_message": (
                f"⚠️  SUPABASE MCP — Xác nhận hành động:\n\n"
                f"Tool: `{tool_name}`"
                + (f"\nĐối tượng: `{obj_id}`" if obj_id else "")
                + f"\nCảnh báo: {reason}\n\n"
                "Đây là dữ liệu y tế quan trọng. Bạn có chắc chắn?"
            ),
            "agent_message": f"Supabase MCP cần xác nhận: {tool_name} — {reason}"
        }))
        return

    # Phân tích SQL cho các tool execute SQL
    if tool_name in SQL_ANALYSIS_TOOLS:
        sql = extract_sql_from_args(tool_name, arguments)
        action, reason = analyze_sql(sql)

        if action == "deny":
            sql_preview = sql[:300].strip()
            print(json.dumps({
                "permission": "deny",
                "user_message": (
                    f"🚫 SUPABASE SQL BỊ CHẶN — Phát hiện lệnh SQL nguy hiểm:\n\n"
                    f"Tool: `{tool_name}`\n"
                    f"Lý do: {reason}\n\n"
                    f"SQL preview:\n```sql\n{sql_preview}\n```\n\n"
                    "Lệnh này có thể xoá dữ liệu y tế bệnh nhân vĩnh viễn. "
                    "Phải thực hiện thủ công sau khi backup và review đầy đủ."
                ),
                "agent_message": f"Supabase MCP SQL bị chặn: {reason}. Tool: {tool_name}"
            }))
            return

        if action == "ask":
            sql_preview = sql[:400].strip()
            print(json.dumps({
                "permission": "ask",
                "user_message": (
                    f"⚠️  SUPABASE SQL — Xác nhận trước khi thực thi:\n\n"
                    f"Tool: `{tool_name}`\n"
                    f"Cảnh báo: {reason}\n\n"
                    f"SQL:\n```sql\n{sql_preview}\n```\n\n"
                    "Migration này sẽ thay đổi schema/dữ liệu production Supabase. "
                    "Đảm bảo đã backup và test trên môi trường dev trước."
                ),
                "agent_message": f"Supabase SQL cần xác nhận: {reason}. Tool: {tool_name}"
            }))
            return

    # Tool an toàn hoặc read-only → cho phép
    print(json.dumps({"permission": "allow"}))

if __name__ == "__main__":
    main()
