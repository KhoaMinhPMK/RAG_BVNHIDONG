'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Navigation progress bar that fires on click (before Next.js starts loading),
 * not after pathname changes (which would be too late — the freeze is already over).
 *
 * Flow:
 *   user clicks <a href="/...">
 *     → click handler fires immediately → bar starts at 10%
 *     → fake progress ticks to ~85% while Next.js fetches chunks
 *     → pathname changes (page mounted) → bar jumps to 100% → fades out
 */
export function RouteLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  const prevPathRef = useRef(pathname);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startProgress = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (hideRef.current) clearTimeout(hideRef.current);
    setVisible(true);
    setProgress(10);
    tickRef.current = setInterval(() => {
      setProgress((p) => {
        // Slow down as it approaches 85% — never auto-complete
        const increment = Math.max(1, (85 - p) * 0.12);
        return Math.min(p + increment, 85);
      });
    }, 250);
  }, []);

  const finishProgress = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    setProgress(100);
    hideRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 350);
  }, []);

  // Complete the bar when the new page is actually mounted (pathname changed)
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname;
      finishProgress();
    }
  }, [pathname, searchParams, finishProgress]);

  // Intercept all internal anchor clicks to start bar immediately
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      // Only same-origin navigations, skip anchors (#), external links, downloads
      const isInternal =
        href.startsWith('/') || href.startsWith('./') || href.startsWith('../');
      const isSamePage = href === pathname || href.startsWith(pathname + '?');
      if (!isInternal || isSamePage || anchor.hasAttribute('download')) return;

      startProgress();
    };

    document.addEventListener('click', handleClick, { capture: true });
    return () => document.removeEventListener('click', handleClick, { capture: true });
  }, [pathname, startProgress]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (hideRef.current) clearTimeout(hideRef.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-[2px] bg-transparent pointer-events-none">
      <div
        className="h-full bg-brand-primary"
        style={{
          width: `${progress}%`,
          transition: progress === 100
            ? 'width 200ms ease-out'
            : 'width 250ms ease-in-out',
          boxShadow: '0 0 6px 0 var(--color-brand-primary, #2563eb)',
        }}
      />
    </div>
  );
}
