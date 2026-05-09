#!/usr/bin/env node
/**
 * postToolUse[Write] — Quét file vừa được ghi để phát hiện secret/token hardcode.
 *
 * Nếu phát hiện pattern nhạy cảm, trả về additional_context cảnh báo để
 * agent thấy và tự sửa trước khi commit.
 *
 * Các pattern được phát hiện:
 *   - Supabase service role key / anon key
 *   - OpenAI / Anthropic API key (sk-...)
 *   - JWT token (eyJ...)
 *   - Generic bearer token
 *   - Chuỗi password= / secret= / api_key= dài hơn 12 ký tự
 *   - AWS Access Key ID + Secret
 *   - Private key PEM block
 *
 * Input JSON (stdin):
 *   { tool: "Write", tool_input: { path, contents }, tool_output: { ... } }
 *
 * Output JSON (stdout):
 *   { additional_context: "..." }   ← nếu phát hiện
 *   {}                              ← nếu sạch
 */
import { readFileSync, existsSync } from 'node:fs';

let raw = '';
try {
  raw = readFileSync(0, 'utf8');
} catch {
  process.stdout.write('{}');
  process.exit(0);
}

let input = {};
try {
  input = raw ? JSON.parse(raw) : {};
} catch {
  process.stdout.write('{}');
  process.exit(0);
}

const filePath = String(
  input?.tool_input?.path ??
  input?.path ??
  ''
).replace(/\\/g, '/');

/** Bỏ qua file không phải source code (media, node_modules, .next, lockfile) */
function shouldSkip(fp) {
  const skipSegments = [
    'node_modules',
    '.next',
    'dist',
    'build',
    '.git',
  ];
  const skipPaths = [
    '/public/fonts/',
    '/public/images/',
  ];
  const skipExts = [
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    '.mp4', '.mp3', '.wav',
    '.lock', '.pack', '.gz',
    '.pdf',
  ];
  // Kiểm tra theo segment (không phụ thuộc leading slash)
  const segments = fp.split('/');
  if (skipSegments.some(s => segments.includes(s))) return true;
  if (skipPaths.some(p => fp.includes(p))) return true;
  if (skipExts.some(e => fp.endsWith(e))) return true;
  return false;
}

if (!filePath || shouldSkip(filePath)) {
  process.stdout.write('{}');
  process.exit(0);
}

/** Đọc nội dung file từ input hoặc đọc từ disk */
let content = String(input?.tool_input?.contents ?? '');
if (!content && existsSync(filePath)) {
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    /* ignore */
  }
}

if (!content) {
  process.stdout.write('{}');
  process.exit(0);
}

const SECRET_PATTERNS = [
  {
    name: 'JWT token (service_role / bearer)',
    // eyJ{header}.{payload}.{signature} — bắt cả JWT ngắn, lọc theo tổng độ dài
    regex: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/g,
    filter: (m) => m.length > 80,
  },
  {
    name: 'OpenAI / Anthropic API key',
    regex: /\b(sk-[a-zA-Z0-9]{20,}|sk-ant-[a-zA-Z0-9_-]{20,})\b/g,
  },
  {
    name: 'AWS Access Key ID',
    regex: /\b(AKIA|ASIA|AROA|AIDA|ANPA|ANVA|APKA)[A-Z0-9]{16}\b/g,
  },
  {
    name: 'PEM Private Key',
    regex: /-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g,
  },
  {
    name: 'Hardcode password/secret/api_key',
    // password="long_value", secret: "long_value", api_key = "long_value"
    regex: /(?:password|secret|api[_-]?key|access[_-]?token|auth[_-]?token)\s*[=:]\s*["'][^"']{12,}["']/gi,
    // Bỏ qua nếu là placeholder
    filter: (m) => !/your[_-]|<[^>]+>|example|placeholder|changeme|xxx|test|todo/i.test(m),
  },
  {
    name: 'Generic Bearer token',
    regex: /Bearer\s+[a-zA-Z0-9_.-]{30,}/g,
    filter: (m) => !m.toLowerCase().includes('$') && !m.includes('{{'),
  },
];

const findings = [];

for (const { name, regex, filter } of SECRET_PATTERNS) {
  regex.lastIndex = 0;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const value = match[0];
    if (filter && !filter(value)) continue;

    // Tìm line number
    const lineNum = content.slice(0, match.index).split('\n').length;
    // Mask giá trị
    const masked =
      value.length > 16
        ? value.slice(0, 6) + '***' + value.slice(-4)
        : '***';

    findings.push(`• **${name}** — dòng ${lineNum}: \`${masked}\``);

    if (findings.length >= 10) break; // tránh spam quá nhiều
  }
  if (findings.length >= 10) break;
}

if (findings.length === 0) {
  process.stdout.write('{}');
  process.exit(0);
}

const context =
  `CANH BAO BAO MAT — file \`${filePath}\` có thể chứa secret hardcode:\n\n` +
  findings.join('\n') +
  '\n\n' +
  'De nghi:\n' +
  '  1. Chuyen gia tri nay sang bien moi truong (.env) neu chua lam\n' +
  '  2. Neu la gia tri gia/placeholder thi giu nguyen va bo qua canh bao nay\n' +
  '  3. Neu da commit secret thiet, can revoke key ngay lap tuc';

process.stdout.write(JSON.stringify({ additional_context: context }));
process.exit(0);
