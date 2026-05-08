'use client';

import { Info } from 'lucide-react';

interface Props {
  tokenCount: number;
  maxTokens?: number;
}

const MAX_TOKENS = 6000;

export function ContextMeter({ tokenCount, maxTokens = MAX_TOKENS }: Props) {
  const pct = Math.min(100, Math.round((tokenCount / maxTokens) * 100));
  const isWarning = pct >= 75 && pct < 90;
  const isCritical = pct >= 90;

  const barColor = isCritical
    ? 'bg-red-500'
    : isWarning
    ? 'bg-amber-400'
    : 'bg-brand-primary';

  const labelColor = isCritical
    ? 'text-red-400'
    : isWarning
    ? 'text-amber-400'
    : 'text-neutral-500';

  if (pct < 50) return null; // don't show meter until above 50%

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.06] bg-neutral-950/50">
      <Info className="w-3 h-3 text-neutral-600 flex-shrink-0" />
      <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-[10px] font-mono ${labelColor} flex-shrink-0`}>
        {pct}% ngữ cảnh
        {isCritical && ' — sắp đầy'}
        {isWarning && ' — gần đầy'}
      </span>
    </div>
  );
}
