'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export function RouteLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Show loading indicator immediately on route change
    setIsLoading(true);

    // Auto-hide after 300ms
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  if (!isLoading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-transparent">
      <div className="h-full bg-brand-primary animate-progress-bar origin-left" />
    </div>
  );
}
