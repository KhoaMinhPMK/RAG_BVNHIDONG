/**
 * Base URL cho fetch tới Express (qua Next `/api/*` hoặc server riêng).
 * - Không set NEXT_PUBLIC_API_URL: trình duyệt dùng same-origin (chuỗi rỗng → URL tương đối).
 * - Có set: dùng URL đó, trừ khi URL là localhost nhưng app đang chạy trên host công khai
 *   (sửa cấu hình Vercel sai `NEXT_PUBLIC_API_URL=http://localhost:3005`).
 * - SSR: Vercel dùng VERCEL_URL; local dùng PORT mặc định 3001.
 */

function parseApiHost(base: string): string | null {
  try {
    return new URL(base).hostname;
  } catch {
    return null;
  }
}

/** Localhost API base không được dùng khi deploy công khai / SSR trên Vercel. */
function resolveExplicitBase(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim().replace(/\/+$/, '');
  if (!trimmed) return undefined;

  const host = parseApiHost(trimmed);
  if (!host) return undefined;

  const localhostish = host === 'localhost' || host === '127.0.0.1';
  if (!localhostish) return trimmed;

  if (typeof window !== 'undefined') {
    const pageHost = window.location.hostname;
    if (pageHost && pageHost !== 'localhost' && pageHost !== '127.0.0.1') {
      return undefined;
    }
    return trimmed;
  }

  if (process.env.VERCEL || process.env.VERCEL_URL) {
    return undefined;
  }

  return trimmed;
}

export function getApiBaseUrl(): string {
  const explicit = resolveExplicitBase(process.env.NEXT_PUBLIC_API_URL);
  if (explicit) return explicit;

  if (typeof window !== 'undefined') {
    return '';
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/+$/, '');
  }

  const port = process.env.PORT || '3001';
  return `http://127.0.0.1:${port}`;
}
