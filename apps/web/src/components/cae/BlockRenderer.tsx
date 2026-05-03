/**
 * BlockRenderer Component
 *
 * Renders structured CAE output blocks with appropriate styling for clinical context.
 * Replaces raw text rendering with typed, semantic components.
 */

import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { RenderableBlock } from '@/types/cae-output';

interface BlockRendererProps {
  blocks: RenderableBlock[];
  onCitationClick?: (citationId: string) => void;
}

export function BlockRenderer({ blocks, onCitationClick }: BlockRendererProps) {
  return (
    <div className="space-y-3">
      {blocks.map((block, index) => (
        <Block key={index} block={block} onCitationClick={onCitationClick} />
      ))}
    </div>
  );
}

interface BlockProps {
  block: RenderableBlock;
  onCitationClick?: (citationId: string) => void;
}

function Block({ block, onCitationClick }: BlockProps) {
  switch (block.type) {
    case 'summary':
      return <SummaryBlock text={block.text} />;
    case 'paragraph':
      return <ParagraphBlock text={block.text} onCitationClick={onCitationClick} />;
    case 'bullet_list':
      return <BulletListBlock items={block.items} />;
    case 'warning':
      return <WarningBlock severity={block.severity} text={block.text} />;
    case 'table':
      return <TableBlock columns={block.columns} rows={block.rows} />;
    case 'evidence_digest':
      return <EvidenceDigestBlock sources={block.sources} />;
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

function ParagraphBlock({ text, onCitationClick }: { text: string; onCitationClick?: (citationId: string) => void }) {
  // Parse citation markers like [1], [2] and make them clickable
  const parts = text.split(/(\[\d+\])/g);

  return (
    <p className="text-sm text-text-primary leading-relaxed">
      {parts.map((part, i) => {
        const match = part.match(/^\[(\d+)\]$/);
        if (match && onCitationClick) {
          const num = match[1];
          return (
            <button
              key={i}
              onClick={() => onCitationClick(num)}
              className="inline-flex items-center justify-center w-[17px] h-[14px] text-[9px] font-bold text-brand-primary bg-brand-light border border-brand-primary/40 rounded-sm mx-0.5 hover:bg-brand-primary hover:text-white transition-colors align-middle"
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
