import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'express-bundle.cjs');
const dest = path.join(root, '.next', 'server', 'express-bundle.cjs');

if (!fs.existsSync(src)) {
  console.warn('[copy-express-bundle] skip: express-bundle.cjs missing (chạy yarn bundle-api-vercel trước khi build production)');
  process.exit(0);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log('[copy-express-bundle] copied to', dest);
