#!/usr/bin/env node
/**
 * preToolUse[Write] — Hỏi xác nhận trước khi ghi đè các file nhạy cảm:
 *   .env, .env.local, .env.production, .env.*.local, *.pem, *secret*, *credential*
 *
 * Input JSON (stdin):
 *   { tool: "Write", tool_input: { path: "...", contents: "..." } }
 *
 * Output JSON (stdout):
 *   { permission: "allow" | "ask", user_message?: "...", agent_message?: "..." }
 */
import { readFileSync } from 'node:fs';

function allow() {
  process.stdout.write(JSON.stringify({ permission: 'allow' }));
}

function ask(path, reason) {
  process.stdout.write(
    JSON.stringify({
      permission: 'ask',
      user_message:
        `Sắp ghi file nhạy cảm: **${path}**\n` +
        `Lý do cảnh báo: ${reason}\n\n` +
        'Xác nhận cho phép ghi không?',
      agent_message:
        `protect-env-files: Ghi vào file nhạy cảm bị chặn: ${path} (${reason}). Chờ xác nhận từ người dùng.`,
    })
  );
}

let raw = '';
try {
  raw = readFileSync(0, 'utf8');
} catch {
  allow();
  process.exit(0);
}

let input = {};
try {
  input = raw ? JSON.parse(raw) : {};
} catch {
  allow();
  process.exit(0);
}

/** Lấy path từ nhiều cấu trúc input khác nhau */
const filePath = String(
  input?.tool_input?.path ??
  input?.path ??
  input?.file_path ??
  ''
).replace(/\\/g, '/');

if (!filePath) {
  allow();
  process.exit(0);
}

const filename = filePath.split('/').pop() ?? '';
const lower = filename.toLowerCase();
const lowerPath = filePath.toLowerCase();

const sensitivePatterns = [
  {
    test: () => /^\.env(\.|$)/.test(lower) || lower === '.env',
    reason: 'File môi trường (.env) chứa key/secret của project',
  },
  {
    test: () => lower.endsWith('.pem') || lower.endsWith('.p12') || lower.endsWith('.pfx'),
    reason: 'File certificate/private key',
  },
  {
    test: () => lower.includes('secret') && (lower.endsWith('.json') || lower.endsWith('.yaml') || lower.endsWith('.yml') || lower.endsWith('.toml')),
    reason: 'Tên file chứa "secret"',
  },
  {
    test: () => lower.includes('credential') && (lower.endsWith('.json') || lower.endsWith('.yaml') || lower.endsWith('.yml')),
    reason: 'Tên file chứa "credential"',
  },
  {
    test: () => lowerPath.includes('/.ssh/'),
    reason: 'File trong thư mục ~/.ssh/',
  },
  {
    test: () => lower === 'service-account.json' || lower === 'serviceaccount.json',
    reason: 'File service account Google Cloud',
  },
];

for (const { test, reason } of sensitivePatterns) {
  try {
    if (test()) {
      ask(filePath, reason);
      process.exit(0);
    }
  } catch {
    /* ignore matcher errors */
  }
}

allow();
process.exit(0);
