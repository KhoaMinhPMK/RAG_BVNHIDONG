/**
 * Evidence Rail - Persistent evidence sidebar
 *
 * Shows citations with trust levels, excerpts, and spatial anchors.
 * Helps answer: What sources? Internal or reference? Which excerpt? Linked to findings?
 */

'use client';

import { useState, useMemo } from 'react';
import { FileText, ExternalLink, MapPin, Calendar, TrendingUp, Filter } from 'lucide-react';
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
  contextHeader = 'Nguồn bằng chứng',
}: EvidenceRailProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('relevance');

  // Filter citations
  const filteredCitations = useMemo(() => {
    let result = [...citations];

    // Apply filter
    if (filter === 'internal') {
      result = result.filter(c => c.trustLevel === 'internal');
    } else if (filter === 'reference') {
      result = result.filter(c => c.trustLevel === 'reference');
    }

    // Apply sort
    if (sort === 'relevance') {
      result.sort((a, b) => b.similarity - a.similarity);
    } else if (sort === 'trust') {
      // Internal first, then by similarity
      result.sort((a, b) => {
        if (a.trustLevel === 'internal' && b.trustLevel !== 'internal') return -1;
        if (a.trustLevel !== 'internal' && b.trustLevel === 'internal') return 1;
        return b.similarity - a.similarity;
      });
    } else if (sort === 'date') {
      result.sort((a, b) => {
        const dateA = a.effectiveDate ? new Date(a.effectiveDate).getTime() : 0;
        const dateB = b.effectiveDate ? new Date(b.effectiveDate).getTime() : 0;
        return dateB - dateA;
      });
    }

    return result;
  }, [citations, filter, sort]);

  // Count by type
  const counts = useMemo(() => {
    const internal = citations.filter(c => c.trustLevel === 'internal').length;
    const reference = citations.filter(c => c.trustLevel === 'reference').length;
    return { internal, reference, total: citations.length };
  }, [citations]);

  if (citations.length === 0) {
    return (
      <div className="w-80 border-l border-border bg-background-secondary/30 p-4 flex flex-col items-center justify-center">
        <FileText className="w-8 h-8 text-text-tertiary mb-2" />
        <p className="text-xs text-text-tertiary text-center">
          Chưa có nguồn bằng chứng
        </p>
      </div>
    );
  }

  return (
    <div className="w-80 border-l border-border bg-background-secondary/30 flex flex-col h-full">
      {/* Context Header */}
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
          {contextHeader}
        </h3>
        <p className="text-[10px] text-text-tertiary mt-0.5">
          {counts.total} nguồn ({counts.internal} nội bộ, {counts.reference} tham khảo)
        </p>
      </div>

      {/* Filters */}
      <div className="px-4 py-2 border-b border-border bg-background-secondary/60">
        <div className="flex items-center gap-2 mb-2">
          <Filter className="w-3 h-3 text-text-tertiary" />
          <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">
            Lọc
          </span>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setFilter('all')}
            className={`text-[10px] px-2 py-1 rounded-sm transition-colors ${
              filter === 'all'
                ? 'bg-brand-primary text-white'
                : 'bg-background border border-border text-text-secondary hover:bg-background-secondary'
            }`}
          >
            Cả hai
          </button>
          <button
            onClick={() => setFilter('internal')}
            className={`text-[10px] px-2 py-1 rounded-sm transition-colors ${
              filter === 'internal'
                ? 'bg-semantic-success text-white'
                : 'bg-background border border-border text-text-secondary hover:bg-background-secondary'
            }`}
          >
            Nội bộ
          </button>
          <button
            onClick={() => setFilter('reference')}
            className={`text-[10px] px-2 py-1 rounded-sm transition-colors ${
              filter === 'reference'
                ? 'bg-brand-secondary text-white'
                : 'bg-background border border-border text-text-secondary hover:bg-background-secondary'
            }`}
          >
            Tham khảo
          </button>
        </div>

        <div className="flex items-center gap-1.5 mt-2">
          <span className="text-[10px] text-text-tertiary">Sắp xếp:</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortType)}
            className="text-[10px] px-2 py-1 rounded-sm bg-background border border-border text-text-primary focus:outline-none focus:border-brand-primary"
          >
            <option value="relevance">Độ liên quan</option>
            <option value="trust">Độ tin cậy</option>
            <option value="date">Ngày hiệu lực</option>
          </select>
        </div>
      </div>

      {/* Source Stack */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredCitations.map((citation) => (
          <CitationCard
            key={citation.citationId}
            citation={citation}
            isActive={citation.citationId === activeCitationId}
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
  onClick: () => void;
  onHover: () => void;
  onLeave: () => void;
}

function CitationCard({ citation, isActive, onClick, onHover, onLeave }: CitationCardProps) {
  const trustBadge = citation.trustLevel === 'internal'
    ? { label: 'Nội bộ', color: 'bg-semantic-success/10 text-semantic-success border-semantic-success/30' }
    : { label: 'Tham khảo', color: 'bg-brand-secondary/10 text-brand-secondary border-brand-secondary/30' };

  const hasSpatialAnchor = citation.findingIds && citation.findingIds.length > 0;

  return (
    <div
      className={`p-3 rounded-sm border transition-all cursor-pointer ${
        isActive
          ? 'border-brand-primary bg-brand-light/10 shadow-sm'
          : 'border-border bg-background hover:border-brand-primary/50 hover:bg-background-secondary'
      }`}
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      {/* Header */}
      <div className="flex items-start gap-2 mb-2">
        <FileText className="w-3.5 h-3.5 text-text-secondary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-medium text-text-primary line-clamp-2 leading-snug">
            {citation.documentTitle}
          </h4>
        </div>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${trustBadge.color} font-medium`}>
          {trustBadge.label}
        </span>
        {hasSpatialAnchor && (
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-brand-primary/30 bg-brand-light/10 text-brand-primary font-medium flex items-center gap-1">
            <MapPin className="w-2.5 h-2.5" />
            Gắn với vùng ảnh
          </span>
        )}
      </div>

      {/* Metadata */}
      {(citation.version || citation.effectiveDate) && (
        <div className="flex items-center gap-3 mb-2 text-[10px] text-text-tertiary">
          {citation.version && (
            <span className="flex items-center gap-1">
              <ExternalLink className="w-2.5 h-2.5" />
              v{citation.version}
            </span>
          )}
          {citation.effectiveDate && (
            <span className="flex items-center gap-1">
              <Calendar className="w-2.5 h-2.5" />
              {new Date(citation.effectiveDate).toLocaleDateString('vi-VN')}
            </span>
          )}
        </div>
      )}

      {/* Excerpt */}
      <p className="text-[10px] text-text-secondary leading-relaxed line-clamp-3 mb-2">
        {citation.excerpt}
      </p>

      {/* Similarity bar */}
      <div className="flex items-center gap-2">
        <TrendingUp className="w-3 h-3 text-text-tertiary" />
        <div className="flex-1 h-1.5 bg-background-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-primary transition-all"
            style={{ width: `${citation.similarity * 100}%` }}
          />
        </div>
        <span className="text-[10px] text-text-tertiary font-mono">
          {(citation.similarity * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
