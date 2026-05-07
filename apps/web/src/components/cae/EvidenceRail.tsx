/**
 * Evidence Rail - Persistent evidence sidebar
 *
 * NotebookLM-style: inline chip click → scroll-to-card + expand excerpt.
 * Hover card → signal back to caller (bidirectional highlight with BlockRenderer).
 * Spatial anchor → caller triggers X-ray spatial focus.
 */

'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { MapPin, ChevronRight, ChevronUp, BookOpen } from 'lucide-react';
import type { CitationAnchor } from '@/types/cae-output';

interface EvidenceRailProps {
  citations: CitationAnchor[];
  activeCitationId: string | null;
  onCitationClick: (id: string) => void;
  onCitationHover: (id: string | null) => void;
  contextHeader?: string;
}

type FilterType = 'all' | 'internal' | 'reference';
type SortType = 'relevance' | 'date' | 'trust';

export function EvidenceRail({
  citations,
  activeCitationId,
  onCitationClick,
  onCitationHover,
  contextHeader = 'Ngu\u1ed3n b\u1eb1ng ch\u1ee9ng',
}: EvidenceRailProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('relevance');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Auto-open + scroll when chip clicked externally
  useEffect(() => {
    if (!activeCitationId) return;
    setIsOpen(true);
    const el = cardRefs.current[activeCitationId];
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 120);
  }, [activeCitationId]);

  const filteredCitations = useMemo(() => {
    let result = [...citations];
    if (filter === 'internal') result = result.filter(c => c.trustLevel === 'internal');
    else if (filter === 'reference') result = result.filter(c => c.trustLevel === 'reference');
    if (sort === 'relevance') result.sort((a, b) => b.similarity - a.similarity);
    else if (sort === 'trust') result.sort((a, b) => {
      if (a.trustLevel === 'internal' && b.trustLevel !== 'internal') return -1;
      if (a.trustLevel !== 'internal' && b.trustLevel === 'internal') return 1;
      return b.similarity - a.similarity;
    });
    else if (sort === 'date') result.sort((a, b) => {
      const dA = a.effectiveDate ? new Date(a.effectiveDate).getTime() : 0;
      const dB = b.effectiveDate ? new Date(b.effectiveDate).getTime() : 0;
      return dB - dA;
    });
    return result;
  }, [citations, filter, sort]);

  const counts = useMemo(() => ({
    internal: citations.filter(c => c.trustLevel === 'internal').length,
    reference: citations.filter(c => c.trustLevel === 'reference').length,
    total: citations.length,
  }), [citations]);

  // ── Collapsed: narrow vertical tab ──────────────────────────────────────
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-8 border-l border-border bg-background-secondary/20 hover:bg-background-secondary/50 flex flex-col items-center py-5 gap-4 transition-colors shrink-0 focus:outline-none group"
        title="M\u1edf ngu\u1ed3n b\u1eb1ng ch\u1ee9ng"
      >
        <BookOpen className="w-3.5 h-3.5 text-text-tertiary group-hover:text-text-secondary transition-colors" />
        <span className="text-[10px] font-medium text-text-tertiary [writing-mode:vertical-lr] rotate-180 tracking-wide select-none group-hover:text-text-secondary transition-colors">
          {contextHeader}
        </span>
        {counts.total > 0 && (
          <span className="w-5 h-5 rounded-full bg-brand-primary/10 border border-brand-primary/25 text-brand-primary text-[9px] font-bold flex items-center justify-center">
            {counts.total}
          </span>
        )}
        <ChevronRight className="w-3 h-3 text-text-tertiary mt-auto group-hover:text-text-secondary transition-colors" />
      </button>
    );
  }

  // ── Expanded panel ───────────────────────────────────────────────────────
  return (
    <div className="w-[296px] border-l border-border bg-background flex flex-col h-full shrink-0">

      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0 flex items-center gap-2.5">
        <BookOpen className="w-3.5 h-3.5 text-text-secondary shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-semibold text-text-primary">{contextHeader}</h3>
          <p className="text-[10px] text-text-tertiary mt-0.5 leading-none">
            {counts.total} ngu\u1ed3n &middot; {counts.internal} n\u1ed9i b\u1ed9 &middot; {counts.reference} tham kh\u1ea3o
          </p>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1.5 rounded-sm text-text-tertiary hover:text-text-primary hover:bg-background-secondary transition-colors"
          title="\u0110\u00f3ng"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Filters */}
      <div className="px-4 py-2.5 border-b border-border bg-background-secondary/25 shrink-0">
        <div className="flex items-center gap-1.5">
          {(['all', 'internal', 'reference'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[10px] px-2.5 py-1 rounded-sm font-medium transition-colors ${
                filter === f
                  ? f === 'internal' ? 'bg-semantic-success text-white' : f === 'reference' ? 'bg-brand-secondary text-white' : 'bg-brand-primary text-white'
                  : 'bg-background border border-border text-text-secondary hover:bg-background-secondary'
              }`}
            >
              {f === 'all' ? 'T\u1ea5t c\u1ea3' : f === 'internal' ? 'N\u1ed9i b\u1ed9' : 'Tham kh\u1ea3o'}
            </button>
          ))}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortType)}
            className="ml-auto text-[10px] px-2 py-1 rounded-sm bg-background border border-border text-text-primary focus:outline-none focus:border-brand-primary/50"
          >
            <option value="relevance">Li\u00ean quan</option>
            <option value="trust">Tin c\u1eady</option>
            <option value="date">Ng\u00e0y</option>
          </select>
        </div>
      </div>

      {/* Card list */}
      <div ref={scrollAreaRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredCitations.map((citation) => (
          <CitationCard
            key={citation.citationId}
            citation={citation}
            isActive={citation.citationId === activeCitationId}
            cardRef={(el) => { cardRefs.current[citation.citationId] = el; }}
            onClick={() => onCitationClick(citation.citationId)}
            onHover={() => onCitationHover(citation.citationId)}
            onLeave={() => onCitationHover(null)}
          />
        ))}
      </div>
    </div>
  );
}

interface CitationCardProps {
  citation: CitationAnchor;
  isActive: boolean;
  cardRef: (el: HTMLDivElement | null) => void;
  onClick: () => void;
  onHover: () => void;
  onLeave: () => void;
}

function CitationCard({ citation, isActive, cardRef, onClick, onHover, onLeave }: CitationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => { if (isActive) setIsExpanded(true); }, [isActive]);

  const isInternal = citation.trustLevel === 'internal';
  const hasSpatialAnchor = citation.findingIds && citation.findingIds.length > 0;
  const pct = Math.round(citation.similarity * 100);

  return (
    <div
      ref={cardRef}
      className={`rounded border transition-all cursor-pointer ${
        isActive
          ? 'border-brand-primary shadow-sm ring-1 ring-brand-primary/15 bg-background'
          : 'border-border bg-background hover:border-border/60 hover:shadow-sm'
      }`}
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <div className="p-3.5">

        {/* Number + title */}
        <div className="flex items-start gap-2.5 mb-2.5">
          <span className={`shrink-0 w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded-sm mt-0.5 ${
            isActive ? 'bg-brand-primary text-white' : 'bg-background-secondary text-text-tertiary'
          }`}>
            {citation.citationId}
          </span>
          <h4 className="text-[11px] font-medium text-text-primary leading-snug flex-1">
            {citation.documentTitle}
          </h4>
        </div>

        {/* Trust badge + spatial + percentage */}
        <div className="flex items-center gap-1.5 mb-2.5">
          <span className={`text-[10px] px-2 py-0.5 rounded-sm font-medium ${
            isInternal ? 'bg-semantic-success/10 text-semantic-success' : 'bg-brand-secondary/10 text-brand-secondary'
          }`}>
            {isInternal ? 'Nội bộ' : 'Tham khảo'}
          </span>
          {hasSpatialAnchor && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-brand-primary/10 text-brand-primary font-medium flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5" />Ảnh
            </span>
          )}
          <span className="ml-auto text-[10px] text-text-tertiary tabular-nums font-mono">{pct}%</span>
        </div>

        {/* Similarity bar */}
        <div className="h-0.5 bg-background-secondary rounded-full overflow-hidden mb-2.5">
          <div
            className={`h-full rounded-full transition-all ${isActive ? 'bg-brand-primary' : 'bg-brand-primary/40'}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Version + date */}
        {(citation.version || citation.effectiveDate) && (
          <p className="text-[10px] text-text-tertiary mb-2.5 leading-none">
            {[
              citation.version && `v${citation.version}`,
              citation.effectiveDate && new Date(citation.effectiveDate).toLocaleDateString('vi-VN', { month: 'short', year: 'numeric' }),
            ].filter(Boolean).join(' · ')}
          </p>
        )}

        {/* Excerpt preview */}
        {!isExpanded ? (
          <p
            className="text-[10px] text-text-secondary leading-relaxed line-clamp-2"
            onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}
          >
            {citation.excerpt}
          </p>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
            className="text-[10px] text-text-tertiary hover:text-text-primary flex items-center gap-1 transition-colors"
          >
            <ChevronUp className="w-3 h-3" />Thu gọn
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="border-t border-border px-3.5 py-3">
          <ExcerptViewer citation={citation} />
        </div>
      )}
    </div>
  );
}

function ExcerptViewer({ citation }: { citation: CitationAnchor }) {
  const ctx = citation.excerptContext;

  if (ctx) {
    return (
      <div className="space-y-1 text-[10px] leading-relaxed">
        {ctx.before && (
          <p className="text-text-tertiary italic pl-2.5 border-l-2 border-border">
            ...{ctx.before}
          </p>
        )}
        <p className="bg-amber-50 border-l-2 border-amber-400 pl-2.5 text-text-primary font-medium py-1">
          {ctx.text}
        </p>
        {ctx.after && (
          <p className="text-text-tertiary italic pl-2.5 border-l-2 border-border">
            {ctx.after}...
          </p>
        )}
      </div>
    );
  }

  return (
    <p className="text-[10px] text-text-primary leading-relaxed bg-amber-50 border-l-2 border-amber-400 pl-2.5 py-1">
      {citation.excerpt}
    </p>
  );
}