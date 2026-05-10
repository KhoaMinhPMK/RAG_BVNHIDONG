'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';
import { Suspense, useState, useRef, useEffect } from 'react';
import { ArrowLeft, ChevronRight, LogOut, Settings, UserCircle, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

// ── Status dot with tooltip ────────────────────────────────────────────────
function StatusDot({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <span
        className={`block w-1.5 h-1.5 rounded-full cursor-default ${
          ok ? 'bg-semantic-success animate-breathe' : 'bg-semantic-error'
        }`}
      />
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full mt-2 right-0 z-50 whitespace-nowrap bg-surface-elevated border border-border rounded-sm px-2.5 py-1.5 shadow-lg pointer-events-none"
          >
            <p className="text-[10px] font-semibold text-text-primary">{label}</p>
            <p className="text-[10px] text-text-tertiary mt-0.5">{detail}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Compact status cluster ─────────────────────────────────────────────────
function StatusCluster() {
  return (
    <div className="flex items-center gap-2.5">
      <StatusDot ok={true}  label="Supabase"  detail="pgvector · connected" />
      <StatusDot ok={true}  label="CAE"       detail="MiMo token-plan · ready" />
      <StatusDot ok={true}  label="Ollama"    detail="qwen2.5:7b · fallback" />
    </div>
  );
}

// ── User avatar button + dropdown ─────────────────────────────────────────
function UserButton() {
  const { profile, user, signOut, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (loading) {
    return <div className="w-7 h-7 rounded-sm bg-surface-elevated animate-pulse" />;
  }

  if (!profile || !user) {
    return (
      <Link
        href="/login"
        className="text-[11px] px-2.5 py-1 bg-brand-primary text-text-inverse rounded-sm hover:bg-brand-hover transition-colors font-medium"
      >
        Đăng nhập
      </Link>
    );
  }

  const initials = profile.full_name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const roleLabels: Record<string, string> = {
    clinician: 'Clinician', radiologist: 'Radiologist',
    researcher: 'Researcher', admin: 'Admin',
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-sm px-1.5 py-1 hover:bg-background-secondary transition-colors"
      >
        <div className="w-6 h-6 rounded-sm bg-brand-light flex items-center justify-center shrink-0">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full rounded-sm object-cover" />
          ) : (
            <span className="text-[9px] font-bold text-brand-primary">{initials}</span>
          )}
        </div>
        <span className="text-[11px] text-text-secondary hidden sm:block">
          {profile.full_name.split(' ').pop()}
        </span>
        <ChevronDown className={`w-3 h-3 text-text-tertiary transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -6 }}
            transition={{ duration: 0.13, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-1.5 w-52 bg-surface-elevated border border-border rounded-sm shadow-xl z-50"
          >
            <div className="px-3 py-2.5 border-b border-border">
              <p className="text-[11px] font-semibold text-text-primary">{profile.full_name}</p>
              <p className="text-[10px] text-text-tertiary mt-0.5">
                {profile.department || 'Nhi khoa'} · {roleLabels[profile.role] || profile.role}
              </p>
            </div>
            <div className="py-1">
              <button
                onClick={() => setOpen(false)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-text-secondary hover:bg-background-tertiary transition-colors"
              >
                <UserCircle className="w-3.5 h-3.5" />Thông tin cá nhân
              </button>
              <button
                onClick={() => setOpen(false)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-text-secondary hover:bg-background-tertiary transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />Cài đặt
              </button>
            </div>
            <div className="border-t border-border py-1">
              <button
                onClick={async () => { setOpen(false); await signOut(); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-semantic-error hover:bg-semantic-error/10 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />Đăng xuất
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Breadcrumb (pathname-aware) ────────────────────────────────────────────
function BreadcrumbInner() {
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();

  const caseMatch = pathname.match(/^\/cases\/([^/]+)$/);
  const isCasePage = caseMatch && pathname !== '/cases/new';
  const step = searchParams?.get('step');

  const stepLabel: Record<string, string> = {
    detection: 'Phát hiện', explain: 'Giải thích', draft: 'Báo cáo',
  };

  if (isCasePage) {
    return (
      <nav className="flex items-center gap-1.5 text-[11px]">
        <Link href="/" className="text-text-tertiary hover:text-text-secondary transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" />
          <span>Worklist</span>
        </Link>
        <ChevronRight className="w-3 h-3 text-border shrink-0" />
        <span className="font-mono font-semibold text-text-primary">{caseMatch[1]}</span>
        {step && stepLabel[step] && (
          <>
            <ChevronRight className="w-3 h-3 text-border shrink-0" />
            <span className="text-brand-primary font-medium">{stepLabel[step]}</span>
          </>
        )}
      </nav>
    );
  }

  if (/^\/knowledge\/[^/]+\/view$/.test(pathname)) {
    return (
      <nav className="flex items-center gap-1.5 text-[11px]">
        <Link href="/knowledge" className="text-text-tertiary hover:text-text-secondary transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" />
          <span>Kho Tri thức</span>
        </Link>
        <ChevronRight className="w-3 h-3 text-border shrink-0" />
        <span className="font-semibold text-text-primary">Xem PDF</span>
      </nav>
    );
  }

  const pageNames: Record<string, string> = {
    '/': 'Worklist', '/cases/new': 'Tạo ca mới',
    '/knowledge': 'Kho Tri thức', '/admin': 'Quản trị',
  };

  return (
    <nav className="flex items-center gap-1.5 text-[11px] text-text-tertiary">
      <span className="font-semibold text-text-primary">{pageNames[pathname] ?? pathname}</span>
    </nav>
  );
}

// ── SlimBar ────────────────────────────────────────────────────────────────
export function SlimBar() {
  return (
    <header className="h-10 border-b border-border bg-background flex items-center px-4 gap-4 shrink-0 z-10">
      {/* Brand mark */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-brand-primary font-bold text-sm tracking-tight leading-none">WebRAG</span>
        <span className="text-[9px] px-1 py-0.5 bg-brand-light text-brand-primary rounded-sm font-semibold leading-none border border-brand-primary/20">
          MVP
        </span>
      </div>

      <div className="w-px h-4 bg-border shrink-0" />

      {/* Breadcrumb */}
      <Suspense fallback={<div className="w-24 h-3 bg-surface-elevated rounded-sm animate-pulse" />}>
        <BreadcrumbInner />
      </Suspense>

      <div className="flex-1" />

      {/* Right cluster */}
      <div className="flex items-center gap-3">
        <StatusCluster />
        <div className="w-px h-4 bg-border shrink-0" />
        <select
          className="text-[10px] bg-transparent border border-border rounded-sm px-1.5 h-6 text-text-tertiary cursor-pointer focus:outline-none focus:border-brand-primary transition-colors"
          defaultValue="vi"
        >
          <option value="vi">VI</option>
          <option value="en">EN</option>
        </select>
        <UserButton />
      </div>
    </header>
  );
}
