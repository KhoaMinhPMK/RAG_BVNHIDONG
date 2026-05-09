#!/usr/bin/env node
/**
 * beforeSubmitPrompt — cảnh báo nếu prompt có vẻ dán secret/token (fail-open nếu lỗi parse).
 * Đọc JSON từ stdin; trả JSON permission trên stdout.
 */
import { readFileSync } from 'node:fs';

function allow() {
  process.stdout.write(JSON.stringify({ permission: 'allow' }));
}

function ask(msg, agent) {
  process.stdout.write(
    JSON.stringify({
      permission: 'ask',
      user_message: msg,
      agent_message: agent ?? msg,
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

const text = JSON.stringify(input).toLowerCase();

const patterns = [
  { re: /supabase_service_role|service_role[_\s]*[:=]/i, msg: 'Prompt có vẻ chứa Supabase service role hoặc từ khóa nhạy cảm.' },
  { re: /eyj[a-z0-9_-]{10,}\.[a-z0-9_-]{10,}\.[a-z0-9_-]{10,}/i, msg: 'Prompt có chuỗi giống JWT (3 phần base64).' },
  { re: /sk-(?:ant|proj|live|test)-[a-z0-9]{20,}/i, msg: 'Prompt có vẻ chứa API key dạng sk-...' },
  { re: /-----begin (?:rsa |openssh )?private key-----/i, msg: 'Prompt có vẻ chứa private key PEM.' },
  { re: /password\s*[:=]\s*['"]?[^\s'"]{8,}/i, msg: 'Prompt có dòng password=... dài — kiểm tra lại.' },
];

for (const { re, msg } of patterns) {
  if (re.test(text)) {
    ask(
      `${msg} Bạn có chắc muốn gửi? (Hook chỉ cảnh báo, không chặn tự động.)`,
      'before-submit-prompt: possible secret material in user message.'
    );
    process.exit(0);
  }
}

allow();
process.exit(0);
