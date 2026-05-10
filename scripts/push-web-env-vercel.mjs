#!/usr/bin/env node
/**
 * Đẩy NEXT_PUBLIC_SUPABASE_* từ apps/web/.env.local lên Vercel.
 * - Production: cả URL + anon (anon dùng --sensitive).
 * - Development: cả hai (anon không được --sensitive trên Development).
 *
 * Preview (deploy từ PR / nhánh): CLI Vercel v53 yêu cầu chọn nhánh Git cụ thể
 * hoặc thêm thủ công trên Dashboard → Environment Variables → chọn Preview.
 * Xem: https://vercel.com/docs/projects/environment-variables
 *
 * Chạy: node scripts/push-web-env-vercel.mjs
 * Yêu cầu: repo đã `vercel link`, đã `vercel login`.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const envPath = path.join(root, 'apps/web/.env.local');

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
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, CI: '1', VERCEL_NONINTERACTIVE: '1' },
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

const raw = fs.readFileSync(envPath, 'utf8');
const env = parseEnv(raw);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.error('Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY trong apps/web/.env.local');
  process.exit(1);
}

for (const target of ['production']) {
  vercelEnvAdd(['add', 'NEXT_PUBLIC_SUPABASE_URL', target, '--value', url, '-y', '--force']);
  vercelEnvAdd(['add', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', target, '--value', anon, '-y', '--force', '--sensitive']);
}

vercelEnvAdd(['add', 'NEXT_PUBLIC_SUPABASE_URL', 'development', '--value', url, '-y', '--force']);
vercelEnvAdd(['add', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'development', '--value', anon, '-y', '--force']);

const api = env.NEXT_PUBLIC_API_URL;
if (api && !api.includes('localhost')) {
  vercelEnvAdd(['add', 'NEXT_PUBLIC_API_URL', 'production', '--value', api, '-y', '--force']);
  console.log('Đã đẩy NEXT_PUBLIC_API_URL → Production.');
} else {
  console.warn(
    'Chưa đẩy NEXT_PUBLIC_API_URL (localhost trong .env.local). Khi có URL API công khai: thêm trên Vercel hoặc sửa .env.local rồi chạy lại script và bổ sung lệnh env add.'
  );
}

console.log('Xong: Supabase NEXT_PUBLIC_* → Production + Development.');
console.log('Preview: mở Vercel → Project → Settings → Environment Variables → thêm cùng giá trị cho môi trường Preview (hoặc “All preview branches”).');
