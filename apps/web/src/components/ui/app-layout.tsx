'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { SlimBar } from './slim-bar';
import { Sidebar } from './sidebar';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { loading, user } = useAuth();

  const SKIP_AUTH = process.env.NEXT_PUBLIC_SKIP_AUTH === 'true';

  const isStandalonePage = pathname === '/login' || pathname === '/forgot-password' || pathname === '/reset-password';

  // Case workspace: /cases/[id] (not /cases/new)
  const isCaseWorkspace = /^\/cases\/[^/]+$/.test(pathname) && pathname !== '/cases/new';

  useEffect(() => {
    if (!SKIP_AUTH && !loading && !user && !isStandalonePage) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, isStandalonePage, pathname, router, SKIP_AUTH]);

  if (isStandalonePage) return <>{children}</>;

  if (!SKIP_AUTH && loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-text-tertiary">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!SKIP_AUTH && !user) return null;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <SlimBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          collapsed={sidebarCollapsed || isCaseWorkspace}
          forceCollapsed={isCaseWorkspace}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        {/* overflow-hidden on case workspace so h-full children resolve to viewport height, not scroll height */}
        <main className={`flex-1 ${isCaseWorkspace ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <div className={`${isCaseWorkspace ? 'p-3' : 'max-w-7xl mx-auto p-5'} h-full`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
