/**
 * BlockRenderer Component
 *
 * Renders structured CAE output blocks with appropriate styling for clinical context.
 * Replaces raw text rendering with typed, semantic components.
 */

import type { ReactNode } from 'react';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { RenderableBlock } from '@/types/cae-output';

interface BlockRendererProps {
  blocks: RenderableBlock[];
  onCitationClick?: (citationId: string) => void;
  onCitationHover?: (citationId: string | null) => void;
  hoveredCitationId?: string | null;
}

export function BlockRenderer({ blocks, onCitationClick, onCitationHover, hoveredCitationId }: BlockRendererProps) {
  return (
    <div className="space-y-3">
      {blocks.map((block, index) => (
        <Block key={index} block={block} onCitationClick={onCitationClick} onCitationHover={onCitationHover} hoveredCitationId={hoveredCitationId} />
      ))}
    </div>
  );
}

interface BlockProps {
  block: RenderableBlock;
  onCitationClick?: (citationId: string) => void;
  onCitationHover?: (citationId: string | null) => void;
  hoveredCitationId?: string | null;
}

function Block({ block, onCitationClick, onCitationHover, hoveredCitationId }: BlockProps) {
  switch (block.type) {
    case 'summary':
      return <SummaryBlock text={block.text} />;
    case 'paragraph':
      return <ParagraphBlock text={block.text} onCitationClick={onCitationClick} onCitationHover={onCitationHover} hoveredCitationId={hoveredCitationId} />;
    case 'bullet_list':
      return <BulletListBlock items={block.items} />;
    case 'warning':
      return <WarningBlock severity={block.severity} text={block.text} />;
    case 'decision_card':
      return <DecisionCardBlockView block={block} onCitationClick={onCitationClick} />;
    case 'table':
      return <TableBlock columns={block.columns} rows={block.rows} />;
    case 'comparison_table':
      return <ComparisonTableBlockView block={block} />;
    case 'evidence_digest':
      return <EvidenceDigestBlock sources={block.sources} />;
    case 'patch_group':
      return <PatchGroupBlockView block={block} onCitationClick={onCitationClick} />;
    case 'field_patch':
      return <FieldPatchBlock patch={block} />;
    default:
      return null;
  }
}

// ============================================================================
// Summary Block
// ============================================================================

function SummaryBlock({ text }: { text: string }) {
  return (
    <div className="rounded-sm border border-brand-primary/30 bg-brand-light/10 p-3">
      <p className="text-sm font-semibold text-text-primary leading-relaxed">
        {text}
      </p>
    </div>
  );
}

// ============================================================================
// Paragraph Block
// ============================================================================

function ParagraphBlock({ text, onCitationClick, onCitationHover, hoveredCitationId }: {
  text: string;
  onCitationClick?: (citationId: string) => void;
  onCitationHover?: (citationId: string | null) => void;
  hoveredCitationId?: string | null;
}) {
  // Parse citation markers like [1], [2] and make them clickable
  const parts = text.split(/(\[\d+\])/g);

  return (
    <p className="text-sm text-text-primary leading-relaxed">
      {parts.map((part, i) => {
        const match = part.match(/^\[(\d+)\]$/);
        if (match && onCitationClick) {
          const num = match[1];
          const isHovered = hoveredCitationId === num;
          return (
            <button
              key={i}
              onClick={() => onCitationClick(num)}
              onMouseEnter={() => onCitationHover?.(num)}
              onMouseLeave={() => onCitationHover?.(null)}
              className={`inline-flex items-center justify-center w-[17px] h-[14px] text-[9px] font-bold rounded-sm mx-0.5 transition-colors align-middle ${
                isHovered
                  ? 'bg-brand-primary text-white ring-1 ring-brand-primary/60 scale-110'
                  : 'text-brand-primary bg-brand-light border border-brand-primary/40 hover:bg-brand-primary hover:text-white'
              }`}
            >
              {num}
            </button>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

// ============================================================================
// Bullet List Block
// ============================================================================

function BulletListBlock({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 pl-4">
      {items.map((item, i) => (
        <li key={i} className="text-sm text-text-primary leading-relaxed list-disc">
          {item}
        </li>
      ))}
    </ul>
  );
}

// ============================================================================
// Warning Block
// ============================================================================

function WarningBlock({ severity, text }: { severity: 'info' | 'caution' | 'high'; text: string }) {
  const config = {
    info: {
      icon: Info,
      borderColor: 'border-blue-400/30',
      bgColor: 'bg-blue-400/5',
      iconColor: 'text-blue-500',
      textColor: 'text-blue-900',
    },
    caution: {
      icon: AlertTriangle,
      borderColor: 'border-semantic-warning/30',
      bgColor: 'bg-semantic-warning/5',
      iconColor: 'text-semantic-warning',
      textColor: 'text-text-primary',
    },
    high: {
      icon: AlertCircle,
      borderColor: 'border-semantic-error/30',
      bgColor: 'bg-semantic-error/5',
      iconColor: 'text-semantic-error',
      textColor: 'text-semantic-error',
    },
  }[severity];

  const Icon = config.icon;

  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded-sm border ${config.borderColor} ${config.bgColor}`}>
      <Icon className={`w-4 h-4 ${config.iconColor} shrink-0 mt-0.5`} />
      <p className={`text-sm ${config.textColor} leading-relaxed`}>
        {text}
      </p>
    </div>
  );
}

function DecisionCardBlockView({
  block,
  onCitationClick,
}: {
  block: Extract<RenderableBlock, { type: 'decision_card' }>;
  onCitationClick?: (citationId: string) => void;
}) {
  const tone = {
    supported: 'border-semantic-success/30 bg-semantic-success/5 text-semantic-success',
    review: 'border-semantic-warning/30 bg-semantic-warning/5 text-semantic-warning',
    blocked: 'border-semantic-error/30 bg-semantic-error/5 text-semantic-error',
  }[block.status];

  return (
    <div className="rounded-sm border border-border bg-background-secondary/40 p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Decision</p>
          <h4 className="text-sm font-semibold text-text-primary mt-1">{block.title}</h4>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-1 rounded-sm border ${tone}`}>
          {block.status === 'supported' ? 'Đủ căn cứ' : block.status === 'review' ? 'Cần rà soát' : 'Bị chặn'}
        </span>
      </div>

      <p className="text-sm text-text-primary leading-relaxed">{block.summary}</p>

      {block.bullets && block.bullets.length > 0 && (
        <ul className="space-y-1.5 pl-4">
          {block.bullets.map((item, index) => (
            <li key={index} className="text-xs text-text-secondary leading-relaxed list-disc">
              {item}
            </li>
          ))}
        </ul>
      )}

      {block.citations.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {block.citations.map((citationId) => (
            <button
              key={citationId}
              onClick={() => onCitationClick?.(citationId)}
              className="text-[10px] font-mono px-2 py-1 rounded-sm border border-brand-primary/30 bg-brand-light/10 text-brand-primary hover:bg-brand-primary hover:text-white transition-colors"
            >
              [{citationId}]
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Table Block
// ============================================================================

function TableBlock({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col, i) => (
              <th key={i} className="text-left px-2 py-1.5 font-semibold text-text-primary bg-background-secondary">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-2 py-1.5 text-text-secondary">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComparisonTableBlockView({
  block,
}: {
  block: Extract<RenderableBlock, { type: 'comparison_table' }>;
}) {
  return (
    <div className="rounded-sm border border-border bg-background-secondary/40 p-3 space-y-3 overflow-x-auto">
      {block.title && (
        <div>
          <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Comparison</p>
          <h4 className="text-sm font-semibold text-text-primary mt-1">{block.title}</h4>
        </div>
      )}

      <table className="w-full min-w-[420px] text-xs border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-2 py-2 font-semibold text-text-primary bg-background">Mục</th>
            {block.columns.map((column, index) => (
              <th key={index} className="text-left px-2 py-2 font-semibold text-text-primary bg-background">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, index) => (
            <tr key={`${row.label}-${index}`} className="border-b border-border last:border-0 align-top">
              <td className="px-2 py-2 font-medium text-text-primary">{row.label}</td>
              {row.values.map((value, valueIndex) => (
                <td
                  key={`${row.label}-${valueIndex}`}
                  className={`px-2 py-2 leading-relaxed ${
                    row.tone === 'warning'
                      ? 'text-semantic-warning'
                      : row.tone === 'positive'
                      ? 'text-semantic-success'
                      : 'text-text-secondary'
                  }`}
                >
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Evidence Digest Block
// ============================================================================

function EvidenceDigestBlock({ sources }: { sources: Array<{ id: string; title: string; trustLevel: 'internal' | 'reference'; similarity: number }> }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">
        Nguồn tham khảo ({sources.length})
      </p>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((source) => (
          <div
            key={source.id}
            className="flex items-center gap-1.5 px-2 py-1 rounded-sm border border-border bg-background-secondary text-[10px]"
          >
            <span
              className={`px-1 py-0.5 rounded-sm font-semibold ${
                source.trustLevel === 'internal'
                  ? 'bg-semantic-success/10 text-semantic-success border border-semantic-success/30'
                  : 'bg-blue-500/10 text-blue-600 border border-blue-500/30'
              }`}
            >
              {source.trustLevel === 'internal' ? 'Nội bộ' : 'Tham khảo'}
            </span>
            <span className="text-text-primary truncate max-w-[200px]">
              {source.title}
            </span>
            <span className="text-text-tertiary font-mono ml-auto">
              {Math.round(source.similarity * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PatchGroupBlockView({
  block,
  onCitationClick,
}: {
  block: Extract<RenderableBlock, { type: 'patch_group' }>;
  onCitationClick?: (citationId: string) => void;
}) {
  return (
    <div className="rounded-sm border border-border bg-background-secondary/40 p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Patch Group</p>
          <h4 className="text-sm font-semibold text-text-primary mt-1">{block.title}</h4>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-text-tertiary">
          <span className="px-2 py-1 rounded-sm border border-border bg-background">{block.summary.ready} sẵn sàng</span>
          <span className="px-2 py-1 rounded-sm border border-semantic-warning/30 bg-semantic-warning/5 text-semantic-warning">{block.summary.review} rà soát</span>
          <span className="px-2 py-1 rounded-sm border border-semantic-error/30 bg-semantic-error/5 text-semantic-error">{block.summary.blocked} blocked</span>
        </div>
      </div>

      <div className="space-y-2">
        {block.patches.map((patch) => (
          <div key={patch.patchId} className="rounded-sm border border-border bg-background px-3 py-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium text-text-primary">{patch.label}</p>
              <span className="text-[10px] text-text-tertiary ml-auto">{Math.round(patch.confidence * 100)}%</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="text-[10px] px-1.5 py-0.5 rounded-sm border border-border bg-background-secondary text-text-tertiary">
                {patch.source === 'ai' ? 'AI đề xuất' : patch.source === 'manual' ? 'Thủ công' : 'Khoá'}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-sm border ${
                patch.status === 'policy_blocked'
                  ? 'border-semantic-error/30 bg-semantic-error/5 text-semantic-error'
                  : patch.status === 'needs_review'
                  ? 'border-semantic-warning/30 bg-semantic-warning/5 text-semantic-warning'
                  : 'border-semantic-success/30 bg-semantic-success/5 text-semantic-success'
              }`}>
                {patch.status === 'policy_blocked' ? 'Bị chặn' : patch.status === 'needs_review' ? 'Cần rà soát' : 'Sẵn sàng'}
              </span>
              {patch.citations.map((citationId) => (
                <button
                  key={`${patch.patchId}-${citationId}`}
                  onClick={() => onCitationClick?.(citationId)}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm border border-brand-primary/30 bg-brand-light/10 text-brand-primary hover:bg-brand-primary hover:text-white transition-colors"
                >
                  [{citationId}]
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Field Patch Block
// ============================================================================

function FieldPatchBlock({ patch }: { patch: Extract<RenderableBlock, { type: 'field_patch' }> }) {
  return (
    <div className="border border-brand-primary/30 rounded-sm bg-brand-light/10 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">
          Đề xuất chỉnh sửa: {patch.fieldKey}
        </p>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-text-tertiary">Độ tin cậy</span>
          <span className="text-[10px] font-mono font-semibold text-brand-primary">
            {Math.round(patch.confidence * 100)}%
          </span>
        </div>
      </div>

      {patch.rationale && (
        <p className="text-xs text-text-secondary leading-relaxed">
          {patch.rationale}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="space-y-1">
          <p className="font-semibold text-text-tertiary">Hiện tại:</p>
          <div className="p-2 rounded-sm bg-red-500/5 border border-red-500/20 text-text-secondary">
            {patch.diff.before || '(trống)'}
          </div>
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-text-tertiary">Đề xuất:</p>
          <div className="p-2 rounded-sm bg-green-500/5 border border-green-500/20 text-text-primary">
            {patch.diff.after}
          </div>
        </div>
      </div>

      {patch.citations.length > 0 && (
        <div className="flex items-center gap-1 pt-1">
          <span className="text-[10px] text-text-tertiary">Nguồn:</span>
          {patch.citations.map((cit, i) => (
            <span key={i} className="text-[10px] font-mono text-brand-primary">
              [{cit}]
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MarkdownContent — lightweight markdown renderer for CAE raw content fallback
// Handles: headers, bold, tables (| col |), bullet lists, hr, citations [n]
// ============================================================================

interface MarkdownContentProps {
  text: string;
  onCitationClick?: (citationId: string) => void;
}

function renderInline(text: string, onCitationClick?: (id: string) => void): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\[\d+\])/g);
  return parts.map((part, i) => {
    const bold = part.match(/^\*\*(.+)\*\*$/);
    if (bold) return <strong key={i} className="font-semibold text-text-primary">{bold[1]}</strong>;
    const cite = part.match(/^\[(\d+)\]$/);
    if (cite && onCitationClick) {
      return (
        <button
          key={i}
          onClick={() => onCitationClick(cite[1])}
          className="inline-flex items-center justify-center w-4 h-3.5 text-[9px] font-bold text-brand-primary bg-brand-light border border-brand-primary/30 rounded-sm mx-0.5 hover:bg-brand-primary hover:text-white transition-colors align-middle"
        >
          {cite[1]}
        </button>
      );
    }
    return part || null;
  });
}

export function MarkdownContent({ text, onCitationClick }: MarkdownContentProps) {
  const lines = text.split('\n');
  const elements: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed) { i++; continue; }

    // Horizontal rule — skip (visual clutter)
    if (/^[-*_]{3,}$/.test(trimmed)) { i++; continue; }

    // Headers
    const hMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
    if (hMatch) {
      const level = hMatch[1].length;
      const txt = hMatch[2];
      const cls = level === 1
        ? 'text-sm font-bold text-text-primary mt-3 mb-1.5'
        : level === 2
          ? 'text-xs font-bold text-text-primary mt-2.5 mb-1'
          : 'text-xs font-semibold text-text-secondary mt-2 mb-0.5';
      elements.push(<p key={i} className={cls}>{renderInline(txt, onCitationClick)}</p>);
      i++;
      continue;
    }

    // Table block — collect all pipe-rows
    if (trimmed.includes('|') && trimmed.split('|').filter(c => c.trim()).length >= 2) {
      const tableRows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes('|')) {
        const row = lines[i].trim()
          .replace(/^\|/, '').replace(/\|$/, '')
          .split('|').map(c => c.trim());
        if (!row.every(c => /^[-: ]+$/.test(c))) tableRows.push(row);
        i++;
      }
      if (tableRows.length > 0) {
        elements.push(
          <div key={`tbl-${i}`} className="overflow-x-auto my-2">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-background-secondary">
                  {tableRows[0].map((cell, j) => (
                    <th key={j} className="text-left px-2 py-1.5 font-semibold text-text-primary whitespace-nowrap">
                      {renderInline(cell, onCitationClick)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.slice(1).map((row, ri) => (
                  <tr key={ri} className="border-b border-border/60 last:border-0 hover:bg-background-secondary/30 transition-colors">
                    {row.map((cell, j) => (
                      <td key={j} className="px-2 py-1.5 text-text-secondary leading-relaxed">
                        {renderInline(cell, onCitationClick)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // Bullet / numbered list — collect consecutive items
    if (/^[-*•]\s|^\d+\.\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s|^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, '').replace(/^\d+\.\s+/, ''));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="space-y-1 pl-3 my-1.5">
          {items.map((item, j) => (
            <li key={j} className="text-xs text-text-primary leading-relaxed flex gap-2">
              <span className="text-brand-primary/60 shrink-0 mt-0.5 text-[10px]">▸</span>
              <span>{renderInline(item, onCitationClick)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="text-xs text-text-primary leading-relaxed">
        {renderInline(trimmed, onCitationClick)}
      </p>
    );
    i++;
  }

  return <div className="space-y-1.5">{elements}</div>;
}
