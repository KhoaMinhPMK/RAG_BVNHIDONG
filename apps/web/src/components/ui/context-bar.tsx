'use client';

import { ShieldCheck, Clock } from 'lucide-react';
import { usePathname } from 'next/navigation';

const pageLabels: Record<string, { title: string; description: string }> = {
  '/':          { title: 'Worklist', description: 'Danh sách ca X-quang đang xử lý' },
  '/cases/new': { title: 'Tạo ca mới', description: 'Upload ảnh X-quang và nhập thông tin bệnh nhân' },
  '/knowledge': { title: 'Kho Tri thức', description: 'Quản lý tài liệu y khoa · pgvector embeddings' },
  '/admin':     { title: 'Quản trị', description: 'RBAC · Audit log · Cấu hình hệ thống' },
};

function getCaseLabel(pathname: string): { title: string; description: string } | null {
  const match = pathname.match(/^\/cases\/([^/]+)/);
  if (!match || pathname === '/cases/new') return null;
  const step = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('step');
  const stepLabel = step === 'explain' ? 'Bước 2: Giải thích' : step === 'draft' ? 'Bước 3: Báo cáo' : 'Bước 1: Phát hiện';
  return {
    title: match[1],
    description: `${stepLabel} · Viêm phổi Nhi khoa`,
  };
}

export function ContextBar() {
  const pathname = usePathname();

  const caseLabel = getCaseLabel(pathname);
  const page = caseLabel ?? pageLabels[pathname] ?? { title: pathname, description: '' };

  return (
    <div className="h-9 border-b border-border bg-background-secondary flex items-center px-4 gap-4 shrink-0">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {caseLabel && (
          <span className="text-[10px] font-mono text-text-tertiary bg-background-tertiary border border-border px-1.5 py-0.5 rounded-sm shrink-0">
            EP
          </span>
        )}
        <span className="text-xs font-semibold text-text-primary truncate">{page.title}</span>
        {page.description && (
          <>
            <span className="text-border shrink-0">·</span>
            <span className="text-xs text-text-tertiary truncate">{page.description}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3 h-3 text-text-tertiary" />
          <span className="text-[10px] text-text-tertiary">Human-in-the-loop · TRIPOD+AI</span>
        </div>
        <div className="flex items-center gap-1.5 text-text-tertiary">
          <Clock className="w-3 h-3" />
          <span className="text-[10px] font-mono" suppressHydrationWarning>
            {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
}
