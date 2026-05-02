/**
 * Page Transition Component
 *
 * Smooth fade + slide transitions between pages
 * Medical-grade: subtle, 200ms duration
 *
 * Usage:
 * export default function MyPage() {
 *   return (
 *     <PageTransition>
 *       <div>Page content</div>
 *     </PageTransition>
 *   );
 * }
 */

'use client';

import { motion } from 'framer-motion';

interface PageTransitionProps {
  children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}
