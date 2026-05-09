#!/usr/bin/env python3
# Hook: format-ts
# Event: afterFileEdit (matcher: Write)
# Mục đích: Sau khi AI ghi file TypeScript/TSX, tự động chạy ESLint --fix và
# trả về kết quả lint dưới dạng additional_context để AI biết có lỗi cần sửa.

import sys
import json
import os
import subprocess
import re
from typing import Optional

WORKSPACE_ROOT = "/Users/admin/Desktop/workspace/RAG_BVNHIDONG"

# Extensions được lint
TS_EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"}

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

def should_lint(path: str) -> bool:
    """Kiểm tra xem file có cần lint không."""
    if not path:
        return False
    _, ext = os.path.splitext(path)
    if ext not in TS_EXTENSIONS:
        return False
    # Bỏ qua node_modules, .next, dist
    skip_dirs = ["/node_modules/", "/.next/", "/dist/", "/build/", "/.yarn/"]
    return not any(d in path for d in skip_dirs)

def find_eslint(file_path: str) -> Optional[str]:
    """Tìm ESLint binary gần nhất theo cây thư mục."""
    # Ưu tiên local eslint trong workspace package
    candidates = [
        os.path.join(WORKSPACE_ROOT, "node_modules/.bin/eslint"),
        os.path.join(WORKSPACE_ROOT, "apps/web/node_modules/.bin/eslint"),
        os.path.join(WORKSPACE_ROOT, "apps/api/node_modules/.bin/eslint"),
    ]
    for c in candidates:
        if os.path.isfile(c) and os.access(c, os.X_OK):
            return c
    # Fallback: eslint trên PATH
    try:
        result = subprocess.run(["which", "eslint"], capture_output=True, text=True, timeout=3)
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
    except Exception:
        pass
    return None

def run_eslint_fix(eslint_bin: str, file_path: str) -> dict:
    """Chạy eslint --fix và trả về kết quả."""
    try:
        result = subprocess.run(
            [eslint_bin, "--fix", "--format", "compact", file_path],
            capture_output=True,
            text=True,
            timeout=20,
            cwd=WORKSPACE_ROOT
        )
        return {
            "exit_code": result.returncode,
            "stdout": result.stdout.strip()[:2000],  # cap output
            "stderr": result.stderr.strip()[:500],
        }
    except subprocess.TimeoutExpired:
        return {"exit_code": -1, "stdout": "", "stderr": "ESLint timeout sau 20s"}
    except Exception as e:
        return {"exit_code": -1, "stdout": "", "stderr": str(e)}

def run_typecheck(file_path: str) -> dict:
    """Chạy tsc --noEmit để kiểm tra TypeScript errors (nhanh)."""
    tsc_bin = os.path.join(WORKSPACE_ROOT, "node_modules/.bin/tsc")
    if not os.path.isfile(tsc_bin):
        return {"skipped": True, "reason": "tsc không tìm thấy"}

    # Xác định tsconfig gần nhất
    dir_path = os.path.dirname(file_path)
    tsconfig = None
    while dir_path and dir_path != WORKSPACE_ROOT:
        candidate = os.path.join(dir_path, "tsconfig.json")
        if os.path.isfile(candidate):
            tsconfig = candidate
            break
        dir_path = os.path.dirname(dir_path)

    if not tsconfig:
        return {"skipped": True, "reason": "Không tìm thấy tsconfig.json"}

    try:
        result = subprocess.run(
            [tsc_bin, "--noEmit", "--project", tsconfig],
            capture_output=True,
            text=True,
            timeout=30,
            cwd=WORKSPACE_ROOT
        )
        output = (result.stdout + result.stderr).strip()
        # Chỉ lấy errors liên quan đến file hiện tại
        file_name = os.path.basename(file_path)
        relevant_lines = [l for l in output.split("\n") if file_name in l]
        return {
            "exit_code": result.returncode,
            "output": "\n".join(relevant_lines[:20]) if relevant_lines else ("OK" if result.returncode == 0 else output[:500]),
        }
    except subprocess.TimeoutExpired:
        return {"exit_code": -1, "output": "TypeCheck timeout sau 30s"}
    except Exception as e:
        return {"exit_code": -1, "output": str(e)}

def main():
    data = load_input()
    file_path = extract_path(data)

    if not should_lint(file_path):
        # Không phải TS file — không làm gì
        print(json.dumps({}))
        return

    short_path = file_path.split("/workspace/")[-1] if "/workspace/" in file_path else file_path
    results = []

    # ── Chạy ESLint fix ──────────────────────────────────────────────────────
    eslint_bin = find_eslint(file_path)
    if eslint_bin:
        lint_result = run_eslint_fix(eslint_bin, file_path)
        if lint_result["exit_code"] == 0:
            results.append("✅ ESLint: Không có lỗi (hoặc đã auto-fix)")
        elif lint_result["exit_code"] == 1 and lint_result["stdout"]:
            results.append(f"⚠️  ESLint còn lỗi sau auto-fix:\n```\n{lint_result['stdout']}\n```")
        elif lint_result["exit_code"] == -1:
            results.append(f"⚙️  ESLint lỗi: {lint_result['stderr']}")
    else:
        results.append("ℹ️  ESLint không có sẵn — bỏ qua lint step")

    # ── Chạy TypeScript check ────────────────────────────────────────────────
    if file_path.endswith((".ts", ".tsx", ".mts")):
        tc_result = run_typecheck(file_path)
        if tc_result.get("skipped"):
            results.append(f"ℹ️  TypeCheck bỏ qua: {tc_result.get('reason', '')}")
        elif tc_result["exit_code"] == 0:
            results.append("✅ TypeScript: Không có type errors")
        else:
            results.append(f"❌ TypeScript errors:\n```\n{tc_result.get('output', '')}\n```")

    if not results:
        print(json.dumps({}))
        return

    context = f"## Kết quả tự động kiểm tra sau khi ghi `{short_path}`\n\n" + "\n\n".join(results)
    print(json.dumps({"additional_context": context}))

if __name__ == "__main__":
    main()
