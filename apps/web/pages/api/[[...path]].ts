import fs from 'fs';
import path from 'path';
import 'pdf-parse';
import 'tiktoken';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { Application } from 'express';
import type { IncomingMessage, ServerResponse } from 'http';

declare const __non_webpack_require__: ((id: string) => { default: Application }) | undefined;

export const config = {
  api: { bodyParser: false, externalResolver: true },
};

function resolveBundlePath(): string {
  const candidates = [
    typeof __dirname !== 'undefined'
      ? path.join(__dirname, '..', '..', 'express-bundle.cjs')
      : '',
    path.join(process.cwd(), 'express-bundle.cjs'),
    path.join(process.cwd(), 'apps', 'web', 'express-bundle.cjs'),
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  throw new Error(`express-bundle.cjs not found. Tried: ${candidates.join(' | ')}`);
}

function loadBundle(bundlePath: string): { default: Application } {
  if (typeof __non_webpack_require__ === 'function') {
    return __non_webpack_require__(bundlePath);
  }
  const req = (0, eval)('require') as NodeJS.Require;
  return req(bundlePath) as { default: Application };
}

let cachedApp: Application | null = null;

function getApp(): Application {
  if (cachedApp) return cachedApp;
  cachedApp = loadBundle(resolveBundlePath()).default;
  return cachedApp;
}

function resolveExpressUrl(req: NextApiRequest): string {
  const u = req.url || '/';
  const qIdx = u.indexOf('?');
  const pathname = qIdx >= 0 ? u.slice(0, qIdx) : u;
  const search = qIdx >= 0 ? u.slice(qIdx) : '';

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return pathname + search;
  }

  const raw = req.query.path;
  const parts = Array.isArray(raw) ? raw : raw != null ? [String(raw)] : [];
  if (parts.length > 0) {
    return `/api/${parts.join('/')}` + search;
  }

  if (pathname !== '/' && pathname !== '') {
    return `/api${pathname.startsWith('/') ? pathname : `/${pathname}`}` + search;
  }

  return '/api' + search;
}

export default async function webragApiCatchAll(req: NextApiRequest, res: NextApiResponse) {
  try {
    const app = getApp();
    const url = resolveExpressUrl(req);
    (req as NextApiRequest & { url?: string; originalUrl?: string }).url = url;
    (req as NextApiRequest & { url?: string; originalUrl?: string }).originalUrl = url;

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      res.once('finish', finish);
      res.once('close', finish);

      const out = (err?: unknown) => {
        if (settled) return;
        settled = true;
        if (err) reject(err instanceof Error ? err : new Error(String(err)));
        else resolve();
      };

      try {
        (app as unknown as { handle: (a: IncomingMessage, b: ServerResponse, c: (e?: unknown) => void) => void }).handle(
          req as IncomingMessage,
          res as ServerResponse,
          out
        );
      } catch (e) {
        out(e);
      }
    });
  } catch (e) {
    if (!res.headersSent) {
      res.status(500).json({
        error: 'WebRAG API bootstrap failed',
        detail: e instanceof Error ? e.message : String(e),
      });
    } else {
      res.end();
    }
  }
}
