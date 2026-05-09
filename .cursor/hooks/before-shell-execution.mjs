#!/usr/bin/env node
/**
 * beforeShellExecution — hỏi lại trước các lệnh có rủi ro cao (fail-open nếu không parse được).
 */
import { readFileSync } from 'node:fs';

function allow() {
  process.stdout.write(JSON.stringify({ permission: 'allow' }));
}

function ask(msg) {
  process.stdout.write(
    JSON.stringify({
      permission: 'ask',
      user_message: msg,
      agent_message: 'before-shell-execution: command matched risky pattern.',
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

const cmd = String(input.command ?? input.shell_command ?? input.cmd ?? '').trim();
const lower = cmd.toLowerCase();

const risky = [
  { test: () => /\brm\s+(-rf|-fr)\b/.test(lower) || /\brm\s+.*\/\s*$/.test(lower), msg: 'Lệnh xóa file (rm -rf / rm thư mục gốc) — xác nhận trước khi chạy.' },
  { test: () => /\bgit\s+push\b.*--force/.test(lower) || /\bgit\s+push\b.*-f\b/.test(lower), msg: 'Git force push — có thể ghi đè remote.' },
  { test: () => /\bdrop\s+(database|schema)\b/i.test(cmd), msg: 'DROP DATABASE/SCHEMA — thao tác phá hủy dữ liệu.' },
  { test: () => /\bsupabase\s+db\s+reset\b/i.test(cmd), msg: 'supabase db reset — reset toàn bộ DB local.' },
  { test: () => /\bmigrate\s+down\b/i.test(cmd) || /\bprisma\s+migrate\s+reset\b/i.test(cmd), msg: 'Migration reset/down — có thể mất dữ liệu.' },
  { test: () => /\bdd\s+if=/.test(lower) && /\bof=/.test(lower), msg: 'dd if=... of=... — có thể ghi đè ổ đĩa.' },
];

for (const { test, msg } of risky) {
  try {
    if (test()) {
      ask(msg);
      process.exit(0);
    }
  } catch {
    /* ignore */
  }
}

allow();
process.exit(0);
