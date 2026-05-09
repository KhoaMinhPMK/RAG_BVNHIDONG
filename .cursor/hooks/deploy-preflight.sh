#!/usr/bin/env python3
# Hook: deploy-preflight
# Event: beforeShellExecution
# Matcher: vercel|yarn.*build|npm.*build|deploy|supabase.*push|supabase.*db push
# Mục đích: Trước khi chạy lệnh build/deploy, tự động kiểm tra checklist an toàn:
# branch, uncommitted changes, env vars, test status. Ngăn deploy sai trên hệ thống y tế.

import sys
import json
import os
import re
import subprocess

WORKSPACE_ROOT = "/Users/admin/Desktop/workspace/RAG_BVNHIDONG"

# Pattern nhận diện lệnh deploy/build
DEPLOY_PATTERNS = [
    r'\bvercel\b(?!.*--help)',
    r'yarn\s+(build|deploy)',
    r'npm\s+run\s+(build|deploy)',
    r'supabase\s+db\s+push',
    r'supabase\s+push',
    r'\bnpm\s+run\s+start\b(?!.*dev)',
    r'yarn\s+start\b(?!.*dev)',
    r'docker\s+(build|push|compose\s+up)',
    r'pm2\s+(start|restart|reload)',
]

def load_input():
    try:
        return json.load(sys.stdin)
    except Exception:
        return {}

def is_deploy_command(cmd: str) -> bool:
    return any(re.search(p, cmd, re.IGNORECASE) for p in DEPLOY_PATTERNS)

def get_git_branch() -> str:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True, text=True, timeout=5, cwd=WORKSPACE_ROOT
        )
        return result.stdout.strip() if result.returncode == 0 else "unknown"
    except Exception:
        return "unknown"

def get_git_status() -> tuple[bool, list[str]]:
    """Trả về (has_uncommitted, list_of_dirty_files)."""
    try:
        result = subprocess.run(
            ["git", "status", "--porcelain"],
            capture_output=True, text=True, timeout=5, cwd=WORKSPACE_ROOT
        )
        if result.returncode != 0:
            return False, []
        lines = [l.strip() for l in result.stdout.strip().split("\n") if l.strip()]
        return len(lines) > 0, lines[:10]  # cap at 10
    except Exception:
        return False, []

def check_env_vars() -> list[str]:
    """Kiểm tra env vars cần thiết có trong môi trường không."""
    required_web = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]
    required_api = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "OLLAMA_BASE_URL"]

    missing = []
    for var in required_web + required_api:
        if not os.environ.get(var):
            # Kiểm tra trong .env files
            env_files = [
                os.path.join(WORKSPACE_ROOT, "apps/web/.env.local"),
                os.path.join(WORKSPACE_ROOT, "apps/web/.env"),
                os.path.join(WORKSPACE_ROOT, "apps/api/.env"),
                os.path.join(WORKSPACE_ROOT, "apps/api/.env.local"),
            ]
            found_in_file = False
            for env_file in env_files:
                if os.path.exists(env_file):
                    try:
                        content = open(env_file).read()
                        if re.search(rf'^{re.escape(var)}\s*=\s*.+', content, re.MULTILINE):
                            found_in_file = True
                            break
                    except Exception:
                        pass
            if not found_in_file:
                missing.append(var)
    return missing

def detect_environment(cmd: str) -> str:
    """Phát hiện đang deploy lên môi trường nào."""
    if re.search(r'(prod|production|--prod)', cmd, re.IGNORECASE):
        return "PRODUCTION"
    if re.search(r'(staging|--preview)', cmd, re.IGNORECASE):
        return "STAGING"
    return "DEVELOPMENT/PREVIEW"

def main():
    data = load_input()
    command = data.get("command", "")

    if not isinstance(command, str) or not command.strip():
        print(json.dumps({"permission": "allow"}))
        return

    if not is_deploy_command(command):
        print(json.dumps({"permission": "allow"}))
        return

    # ── Bắt đầu kiểm tra preflight ───────────────────────────────────────────
    issues = []
    warnings = []
    info = []

    # 1. Kiểm tra branch
    branch = get_git_branch()
    if branch in ("main", "master"):
        issues.append(f"⚠️  Bạn đang deploy từ nhánh `{branch}` (production branch)")
    else:
        info.append(f"✅ Nhánh hiện tại: `{branch}`")

    # 2. Kiểm tra uncommitted changes
    has_dirty, dirty_files = get_git_status()
    if has_dirty:
        file_list = "\n".join(f"   {f}" for f in dirty_files)
        warnings.append(
            f"⚠️  Có {len(dirty_files)} file chưa commit:\n{file_list}"
            + ("\n   ..." if len(dirty_files) == 10 else "")
        )
    else:
        info.append("✅ Working tree sạch (không có uncommitted changes)")

    # 3. Kiểm tra env vars
    missing_vars = check_env_vars()
    if missing_vars:
        warnings.append(
            "⚠️  Thiếu environment variables:\n"
            + "\n".join(f"   - {v}" for v in missing_vars)
        )
    else:
        info.append("✅ Environment variables đầy đủ")

    # 4. Phát hiện môi trường target
    env_target = detect_environment(command)
    if env_target == "PRODUCTION":
        issues.append("🚨 Deploy lên PRODUCTION — cần kiểm tra kỹ!")
    else:
        info.append(f"ℹ️  Môi trường target: {env_target}")

    # 5. Nhắc nhở checklist y tế
    med_checklist = (
        "### Checklist trước deploy hệ thống y tế:\n"
        "- [ ] Đã test luồng: pending_detection → pending_explain → pending_draft → pending_approval → completed\n"
        "- [ ] Đã kiểm tra auth/RBAC không bị bypass\n"
        "- [ ] API rate limiting và error handling ổn định\n"
        "- [ ] Không có PHI bệnh nhân trong logs\n"
        "- [ ] CAE streaming hoạt động đúng\n"
        "- [ ] Draft approval flow đúng nghiệp vụ"
    )

    # ── Quyết định action ─────────────────────────────────────────────────────
    has_critical = len(issues) > 0
    has_warnings = len(warnings) > 0

    parts = []
    if issues:
        parts.append("### ⛔ Vấn đề cần xem xét:\n" + "\n".join(issues))
    if warnings:
        parts.append("### ⚠️  Cảnh báo:\n" + "\n".join(warnings))
    if info:
        parts.append("### ℹ️  Thông tin:\n" + "\n".join(info))
    parts.append(med_checklist)

    message_body = "\n\n".join(parts)

    print(json.dumps({
        "permission": "ask",
        "user_message": (
            f"🚀 DEPLOY PREFLIGHT CHECK — `{command[:100]}`\n\n"
            + message_body
            + "\n\nBạn có muốn tiếp tục deploy không?"
        ),
        "agent_message": (
            f"Deploy preflight completed for: {command[:80]}. "
            f"Branch: {branch}. "
            f"Issues: {len(issues)}. Warnings: {len(warnings)}."
        )
    }))

if __name__ == "__main__":
    main()
