'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Header } from './header';
import { Sidebar } from './sidebar';
import { ContextBar } from './context-bar';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { loading, user } = useAuth();

  // 🚨 TEMPORARY: Skip auth for testing (remove in production)
  const SKIP_AUTH = process.env.NEXT_PUBLIC_SKIP_AUTH === 'true';

  // Pages that should NOT have sidebar/header (standalone pages)
  const isStandalonePage = pathname === '/login' || pathname === '/forgot-password' || pathname === '/reset-password';

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!SKIP_AUTH && !loading && !user && !isStandalonePage) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, isStandalonePage, pathname, router, SKIP_AUTH]);

  // Render standalone pages without layout
  if (isStandalonePage) {
    return <>{children}</>;
  }

  // Show loading spinner during auth initialization (skip if SKIP_AUTH)
  if (!SKIP_AUTH && loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-text-tertiary">Đang tải...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated (after loading completes) - skip if SKIP_AUTH
  if (!SKIP_AUTH && !user) {
    return null; // Will redirect via useEffect
  }

  // Render normal pages with full layout
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Header />
      <ContextBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-5 h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
