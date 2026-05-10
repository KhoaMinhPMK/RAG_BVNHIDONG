#!/usr/bin/env node
/**
 * Đẩy biến server API (apps/api/.env) lên Vercel — **Production** (ổn định với CLI non-interactive).
 * CORS: thêm https://webrag-web.vercel.app nếu chưa có (giữ các origin hiện có).
 *
 * Preview: Dashboard → Environment Variables → chọn Preview / “All preview branches”
 * (CLI `env add … preview` thường bắt chọn nhánh khi chạy trong CI).
 *
 * Chạy: node scripts/sync-api-env-vercel.mjs
 * Yêu cầu: vercel login, project đã link (thư mục repo).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const envPath = path.join(root, 'apps/api/.env');

const PROD_ORIGIN = 'https://webrag-web.vercel.app';

function parseEnv(raw) {
  const out = {};
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function vercelEnvAdd(args) {
  const r = spawnSync('npx', ['vercel@latest', 'env', ...args], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CI: '1', VERCEL_NONINTERACTIVE: '1' },
  });
  const err = (r.stderr && r.stderr.toString()) || '';
  const out = (r.stdout && r.stdout.toString()) || '';
  if (r.status !== 0) {
    console.error(out + err);
    process.exit(r.status ?? 1);
  }
}

function mergeCors(raw) {
  const parts = (raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.includes(PROD_ORIGIN)) parts.push(PROD_ORIGIN);
  return parts.join(',');
}

if (!fs.existsSync(envPath)) {
  console.error('Không thấy apps/api/.env — tạo từ .env.example và điền Supabase + LLM.');
  process.exit(1);
}

const env = parseEnv(fs.readFileSync(envPath, 'utf8'));

const keys = [
  { key: 'SUPABASE_URL', sensitive: false },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', sensitive: true },
  { key: 'SUPABASE_ANON_KEY', sensitive: true },
  { key: 'OLLAMA_URL', sensitive: false },
  { key: 'OLLAMA_MODEL', sensitive: false },
  { key: 'MIMO_API_KEY', sensitive: true },
  { key: 'LOG_LEVEL', sensitive: false },
];

const missing = keys.filter(({ key }) => !env[key]?.trim()).map(({ key }) => key);
if (missing.length) {
  console.error('Thiếu giá trị trong apps/api/.env:', missing.join(', '));
  process.exit(1);
}

const cors = mergeCors(env.CORS_ORIGIN);

for (const target of ['production']) {
  for (const { key, sensitive } of keys) {
    const v = env[key].trim();
    const args = ['add', key, target, '--value', v, '-y', '--force'];
    if (sensitive) args.push('--sensitive');
    vercelEnvAdd(args);
    console.log(`OK ${key} → ${target}`);
  }
  vercelEnvAdd(['add', 'CORS_ORIGIN', target, '--value', cors, '-y', '--force']);
  console.log(`OK CORS_ORIGIN → ${target} (${cors.split(',').length} origins)`);
}

console.log('Xong: API server env → Production. Redeploy production trên Vercel để function nhận env mới.');
