'use client';

import { Suspense, useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Activity, BookOpen, ClipboardList,
  ChevronRight, AlertTriangle, Play, Check, X,
  User, Calendar, Stethoscope,
  Loader2, RefreshCw, FlaskConical,
  Maximize2, Minimize2, Brain, Eye, Printer, Database, Save, Download,
  Cpu, ChevronDown, ChevronUp,
} from 'lucide-react';
import { PageTransition } from '@/components/ui/page-transition';
import { DetectionSkeleton } from '@/components/ui/loading-skeleton';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { getEpisodeDetail, getEpisodeImageUrl, getLatestAiRun, getLatestDraft, invalidateDraftCache, saveDraftFields, approveDraft } from '@/lib/api/client';
import type { AiRunRow } from '@/lib/api/client';
import { CAEDock } from '@/components/cae/CAEDock';
import { BlockRenderer } from '@/components/cae/BlockRenderer';
import { EvidenceRail } from '@/components/cae/EvidenceRail';
import { useCAEStream } from '@/hooks/useCAEStream';
import type { CitationAnchor, RenderableBlock, UIAction } from '@/types/cae-output';
import { downloadReportPDF } from '@/components/pdf/ReportPDF';

// ─── Types ─────────────────────────────────────────────────────────────────
type Step = 'detection' | 'explain' | 'draft';
type PanelMode = 'wide' | 'balanced' | 'compact';
interface DraftProvenance {
  document_id: string;
  document_title: string;
  version?: string;
  effective_date?: string;
  excerpt: string;
}
interface DraftField {
  key: string; label: string; value: string;
  modified: boolean; rows: number;
  source: 'ai' | 'manual' | 'locked';
  status: 'valid' | 'needs_review' | 'policy_blocked';
  provenance: DraftProvenance[];
}
interface Citation { num: number; ref: string; section: string; passage: string; confidence: number; }
interface CaseInfo { patientRef: string; age: string; gender: string; date: string; symptoms: string; spo2: string; crp: string; }

interface PcxrAnnotation {
  id: number;
  categoryId: number;
  category: string;
  bbox: [number, number, number, number]; // x y w h (pixels, image is 1280×1280)
}
interface PcxrSample {
  idx: number; key: string; imageId: string; imgSrc: string; dim: number;
  annotations: PcxrAnnotation[];
}

// PCXR_SAMPLES removed — real images are now fetched from Supabase Storage

// Category color palette (deterministic by categoryId)
const CAT_COLORS = [
  { border: 'border-yellow-400', bgHover: 'bg-yellow-400/20', dot: '#facc15', tag: 'bg-yellow-500 text-zinc-900' },
  { border: 'border-red-400',    bgHover: 'bg-red-400/20',    dot: '#f87171', tag: 'bg-red-600 text-white' },
  { border: 'border-blue-400',   bgHover: 'bg-blue-400/20',   dot: '#60a5fa', tag: 'bg-blue-600 text-white' },
  { border: 'border-green-400',  bgHover: 'bg-green-400/20',  dot: '#4ade80', tag: 'bg-green-600 text-white' },
  { border: 'border-purple-400', bgHover: 'bg-purple-400/20', dot: '#c084fc', tag: 'bg-purple-600 text-white' },
  { border: 'border-orange-400', bgHover: 'bg-orange-400/20', dot: '#fb923c', tag: 'bg-orange-500 text-white' },
] as const;

function catColor(categoryId: number) { return CAT_COLORS[categoryId % CAT_COLORS.length]; }
// Category short names
const CAT_SHORT: Record<number, string> = {
  6: 'Dày thành phế quản', 8: 'Tim to', 18: 'Xương sườn trước giãn',
  30: 'Mờ quanh phế quản–mạch', 35: 'Mờ lưới–hạt',
};
function catShort(categoryId: number, fallback: string) {
  return CAT_SHORT[categoryId] ?? fallback.slice(0, 28);
}

// ─── Default case info (used as fallback before episode loads) ─────────────
const DEFAULT_CASE_INFO: CaseInfo = {
  patientRef: '—', age: '—', gender: '—',
  date: '—', symptoms: '—',
  spo2: '—', crp: '—',
};

// EPISODE_TO_SAMPLE removed — real images fetched from API

// ─── Panel width presets ────────────────────────────────────────────────────
const PANEL_WIDTHS: Record<PanelMode, number> = { wide: 54, balanced: 44, compact: 30 };
const STEP_DEFAULT_MODE: Record<Step, PanelMode> = { detection: 'wide', explain: 'balanced', draft: 'compact' };

// ─── Helpers ───────────────────────────────────────────────────────────────
function streamText(text: string, onUpdate: (s: string) => void, onDone: () => void) {
  const toks = text.split(/( |\n)/); let i = 0; let acc = '';
  function tick() {
    if (i < toks.length) { acc += toks[i++]; onUpdate(acc); setTimeout(tick, 14); } else onDone();
  }
  setTimeout(tick, 180);
}
function buildDetectionPayload(episodeId: string, annotations: PcxrAnnotation[]) {
  return {
    image_id: episodeId,
    detections: annotations.map(annotation => ({
      bbox: annotation.bbox,
      label: annotation.category,
      score: 0.75,
    })),
  };
}

function getFieldRows(value: string) {
  if (!value) return 3;
  if (value.length > 180) return 5;
  if (value.length > 80) return 3;
  return 2;
}

function normalizeFieldKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

function matchesFieldKey(field: Pick<DraftField, 'key' | 'label'>, candidate: string | null) {
  if (!candidate) {
    return false;
  }

  const normalizedCandidate = normalizeFieldKey(candidate);
  return normalizeFieldKey(field.key) === normalizedCandidate || normalizeFieldKey(field.label) === normalizedCandidate;
}

function mapApiCitation(citation: any, index: number): Citation {
  return {
    num: index + 1,
    ref: `${citation.document_title ?? 'Nguồn tham khảo'}${citation.version ? ` · ${citation.version}` : ''}`,
    section: citation.effective_date ?? '',
    passage: citation.excerpt ?? '',
    confidence: 0.8,
  };
}

function mapStructuredCitation(citation: CitationAnchor, index: number): Citation {
  const sectionParts = [citation.effectiveDate, citation.trustLevel === 'internal' ? 'Nội bộ' : 'Tham khảo'].filter(Boolean);
  const parsedNum = Number.parseInt(citation.citationId, 10);
  return {
    num: Number.isFinite(parsedNum) ? parsedNum : index + 1,
    ref: `${citation.documentTitle}${citation.version ? ` · ${citation.version}` : ''}`,
    section: sectionParts.join(' · '),
    passage: citation.excerpt || 'Chưa có đoạn trích phù hợp từ knowledge base.',
    confidence: citation.similarity,
  };
}

function mapDraftFields(fields: Array<{
  field_id: string;
  label: string;
  value: unknown;
  source: 'ai' | 'manual' | 'locked';
  provenance: DraftProvenance[];
  status: 'valid' | 'needs_review' | 'policy_blocked';
}>): DraftField[] {
  return fields.map(field => {
    const strValue = toFieldString(field.value);
    return {
      key: field.field_id,
      label: field.label,
      value: strValue,
      modified: false,
      rows: getFieldRows(strValue),
      source: field.source,
      status: field.status,
      provenance: field.provenance ?? [],
    };
  });
}

/** Safely coerce an AI field value to a plain string regardless of LLM output shape */
function toFieldString(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v == null) return '';
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    if (typeof obj.text    === 'string') return obj.text;
    if (typeof obj.value   === 'string') return obj.value;
    if (typeof obj.content === 'string') return obj.content;
    return JSON.stringify(v);
  }
  return String(v);
}

function mapPatchBlocksToDraftFields(blocks: RenderableBlock[]): DraftField[] {
  return blocks
    .filter((block): block is Extract<RenderableBlock, { type: 'field_patch' }> => block.type === 'field_patch')
    .map((block) => ({
      key: block.fieldKey,
      label: block.label ?? block.fieldKey,
      value: toFieldString(block.diff.after),
      modified: false,
      rows: getFieldRows(toFieldString(block.diff.after)),
      source: block.source ?? 'ai',
      status: block.status ?? 'needs_review',
      provenance: (block.provenance ?? []).map((citation) => ({
        document_id: citation.document_id,
        document_title: citation.document_title,
        version: citation.version,
        effective_date: citation.effective_date,
        excerpt: citation.excerpt,
      })),
    }));
}

function extractNarrativeHighlights(text: string, limit = 3) {
  const normalized = text
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\[\d+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) {
    return [];
  }

  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length === 0) {
    return [normalized.slice(0, 180)];
  }

  return sentences.slice(0, limit);
}

function resolveFindingIndex(annotations: PcxrAnnotation[], findingId: string): number | null {
  const directMatch = annotations.findIndex(a => String(a.id) === findingId);
  if (directMatch >= 0) return directMatch;
  const norm = findingId.toLowerCase();
  const labelMatch = annotations.findIndex(a =>
    a.category.toLowerCase().includes(norm) || catShort(a.categoryId, a.category).toLowerCase().includes(norm)
  );
  return labelMatch >= 0 ? labelMatch : null;
}

// ─── TextWithCitations ─────────────────────────────────────────────────────
function TextWithCitations({ text, onCitationClick }: { text: string; onCitationClick: (n: number) => void }) {
  return (
    <>
      {text.split(/(\[\d+\])/g).map((part, i) => {
        const m = part.match(/^\[(\d+)\]$/);
        if (m) {
          const n = parseInt(m[1]);
          return (
            <button key={i} onClick={() => onCitationClick(n)} title={`Xem nguồn [${n}]`}
              className="inline-flex items-center justify-center w-4.25 h-3.5 text-[9px] font-bold text-brand-primary bg-brand-light border border-brand-primary/40 rounded-sm mx-0.5 hover:bg-brand-primary hover:text-white transition-colors align-middle">
              {n}
            </button>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ─── Citation popup ─────────────────────────────────────────────────────────
function CitationPopup({ num, citations, onClose }: { num: number; citations: Citation[]; onClose: () => void }) {
  const c = citations.find(x => x.num === num);
  if (!c) return null;
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Popup */}
      <div className="fixed right-4 z-50 w-80 bg-surface border border-border rounded-sm shadow-2xl flex flex-col animate-slide-down" style={{ top: 72, maxHeight: '62vh' }}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-background-secondary shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-brand-primary bg-brand-light border border-brand-primary/30 px-1.5 py-0.5 rounded-sm">[{num}]</span>
          <span className="text-xs font-semibold text-text-primary">Nguồn trích dẫn</span>
        </div>
        <button onClick={onClose} className="w-5 h-5 flex items-center justify-center rounded-sm hover:bg-border text-text-tertiary transition-colors"><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div>
          <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">Tài liệu</p>
          <p className="text-xs font-medium text-text-primary">{c.ref}</p>
          <p className="text-[10px] text-text-tertiary mt-0.5">{c.section}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1.5">Đoạn trích</p>
          <blockquote className="border-l-2 border-brand-primary pl-2.5 text-[11px] text-text-secondary leading-relaxed italic">&ldquo;{c.passage}&rdquo;</blockquote>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] text-text-tertiary">Độ liên quan</span>
            <span className="text-[10px] font-mono text-text-primary font-semibold ml-auto">{Math.round(c.confidence * 100)}%</span>
          </div>
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-brand-primary rounded-full" style={{ width: `${c.confidence * 100}%` }} />
          </div>
        </div>
        <Link href="/knowledge" onClick={onClose}
          className="flex items-center justify-center gap-1.5 w-full text-[11px] text-brand-primary border border-brand-primary/30 rounded-sm py-1.5 hover:bg-brand-light transition-colors">
          <BookOpen className="w-3 h-3" />Mở trong Knowledge Base
        </Link>
      </div>
    </div>
    </>
  );
}

// XrayViewport — ResizeObserver measures the available container space,
// then renders a square that is min(containerWidth, containerHeight).
// Bboxes are % of this square, so they always align correctly with the image.
function XrayViewport({
  sample, hoveredIdx, onHoverIdx, focusedIdx, onFocusIdx,
}: {
  sample: PcxrSample;
  hoveredIdx: number | null;
  onHoverIdx: (i: number | null) => void;
  focusedIdx: number | null;
  onFocusIdx: (i: number | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const [squarePx, setSquarePx] = useState(0);
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showScan, setShowScan] = useState(true);
  const dim = sample.dim;

  // One-time scan animation on mount
  useEffect(() => {
    const t = setTimeout(() => setShowScan(false), 1800);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect();
      setSquarePx(Math.floor(Math.min(width, height)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Zoom to bbox when focusedIdx changes
  useEffect(() => {
    if (focusedIdx === null) {
      setTransform({ scale: 1, x: 0, y: 0 });
      return;
    }

    const ann = sample.annotations[focusedIdx];
    if (!ann) return;

    const [px, py, pw, ph] = ann.bbox;
    const centerX = (px + pw / 2) / dim;
    const centerY = (py + ph / 2) / dim;
    const targetScale = 2.5;

    // Calculate pixel offset to center the bbox
    const offsetX = (0.5 - centerX) * squarePx;
    const offsetY = (0.5 - centerY) * squarePx;

    setTransform({ scale: targetScale, x: offsetX, y: offsetY });
  }, [focusedIdx, sample.annotations, dim, squarePx]);

  // Mouse wheel zoom
  useEffect(() => {
    const el = imageRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY;
      const zoomSpeed = 0.001;
      const newScale = Math.max(1, Math.min(5, transform.scale - delta * zoomSpeed));
      setTransform(prev => ({ ...prev, scale: newScale }));
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [transform.scale]);

  // Mouse drag pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (transform.scale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    setTransform(prev => ({
      ...prev,
      x: prev.x + deltaX / transform.scale,
      y: prev.y + deltaY / transform.scale
    }));
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div ref={containerRef} className="w-full h-full bg-black flex items-center justify-center overflow-hidden relative">
      {squarePx > 0 && (
        <>
          <div
            ref={imageRef}
            className="relative shrink-0"
            style={{
              width: squarePx,
              height: squarePx,
              transform: `scale(${transform.scale}) translate(${transform.x}px, ${transform.y}px)`,
              transition: isDragging ? 'none' : 'transform 400ms ease-out',
              cursor: transform.scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
          {/* Scan line — one-time sweep on mount */}
          {showScan && squarePx > 0 && (
            <motion.div
              initial={{ y: 0 }}
              animate={{ y: squarePx }}
              transition={{ duration: 1.5, ease: 'linear' }}
              onAnimationComplete={() => setShowScan(false)}
              className="absolute top-0 left-0 right-0 h-px pointer-events-none z-30"
              style={{
                backgroundColor: 'rgba(20, 184, 166, 0.75)',
                boxShadow: '0 0 10px 3px rgba(20, 184, 166, 0.35)',
              }}
            />
          )}

          {/* Real X-ray image */}
          {sample.imgSrc ? (
            <img
              src={sample.imgSrc}
              alt={sample.imageId}
              className="absolute inset-0 w-full h-full"
              style={{ objectFit: 'cover' }}
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-600">
              <svg className="w-12 h-12 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5"/>
                <path d="M3 9l4-4 4 4 4-4 4 4" strokeWidth="1.5"/>
              </svg>
              <span className="text-xs opacity-50">Chưa có ảnh X-quang</span>
            </div>
          )}

          {/* Bounding boxes — % of the square, matching the pixel coords in dim×dim space */}
          {sample.annotations.map((ann, i) => {
            const [px, py, pw, ph] = ann.bbox;
            const l = (px / dim) * 100;
            const t = (py / dim) * 100;
            const w = (pw / dim) * 100;
            const h = (ph / dim) * 100;
            const col = catColor(ann.categoryId);
            const isHot = hoveredIdx === i;
            const isFocused = focusedIdx === i;
            return (
              <div key={ann.id}
                onMouseEnter={() => onHoverIdx(i)}
                onMouseLeave={() => onHoverIdx(null)}
                onClick={() => onFocusIdx(focusedIdx === i ? null : i)}
                style={{
                  position: 'absolute',
                  left: `${l}%`,
                  top: `${t}%`,
                  width: `${w}%`,
                  height: `${h}%`,
                  zIndex: isFocused ? 20 : 1,
                  animationDelay: `${0.9 + i * 0.18}s`,
                }}
                className={`border-2 cursor-pointer transition-all duration-150 animate-bbox-reveal ${col.border} ${isHot || isFocused ? col.bgHover : 'bg-transparent'}`}
              >
                {[[-4, -4], [-4, undefined], [undefined, -4], [undefined, undefined]].map(([top, left], ci) => (
                  <div key={ci} style={{
                    position: 'absolute',
                    top: top !== undefined ? top : undefined,
                    bottom: top === undefined ? -4 : undefined,
                    left: left !== undefined ? left : undefined,
                    right: left === undefined ? -4 : undefined,
                    width: 6, height: 6, borderRadius: '50%', backgroundColor: col.dot,
                  }} />
                ))}
                <div className={`absolute -top-5 left-0 px-1.5 py-0.5 rounded-sm text-[9px] font-bold whitespace-nowrap transition-opacity ${col.tag} ${isHot ? 'opacity-100' : 'opacity-65'}`}>
                  {catShort(ann.categoryId, ann.category)} · {(0.75 * 100).toFixed(0)}%
                </div>
              </div>
            );
          })}

          {/* Image ID badge */}
          <div className="absolute bottom-1.5 right-2 text-[9px] font-mono text-white/40 pointer-events-none select-none">
            {sample.imageId}
          </div>
        </div>
        </>
      )}
    </div>
  );
}

// ─── Image panel ───────────────────────────────────────────────────────────
// ── CXR AI Analysis Panel ────────────────────────────────────────────────────
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

interface CxrPrediction { label: string; probability: number; }
interface CxrResult {
  top_finding: string;
  predictions: CxrPrediction[];
  heatmaps: Record<string, string>; // base64 JPEG
}

function CxrAnalysisPanel({ episodeId, imgSrc }: { episodeId: string; imgSrc: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<CxrResult | null>(null);
  const [error, setError] = useState('');
  const [heatmapTab, setHeatmapTab] = useState('Pneumonia');
  const [expanded, setExpanded] = useState(false);

  // Auto-load existing analysis results on mount
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/cxr/status/${episodeId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data.success && data.status === 'completed' && data.results) {
          const r = data.results as CxrResult;
          setResult(r);
          setHeatmapTab(Object.keys(r.heatmaps ?? {})[0] ?? 'Pneumonia');
          setState('done');
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [episodeId]);

  const analyze = async () => {
    if (!imgSrc) { setError('Chưa có ảnh X-quang'); setState('error'); return; }
    setState('loading');
    setError('');
    try {
      const imgRes = await fetch(imgSrc);
      if (!imgRes.ok) throw new Error('Không tải được ảnh');
      const blob = await imgRes.blob();

      const form = new FormData();
      form.append('image', blob, 'xray.png');

      const res = await fetch(`${API_BASE}/api/cxr/analyze/${episodeId}`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json() as CxrResult;
      setResult(data);
      setHeatmapTab(Object.keys(data.heatmaps)[0] ?? 'Pneumonia');
      setState('done');
      setExpanded(true);
    } catch (e) {
      setError(String(e));
      setState('error');
    }
  };

  const LABEL_VI: Record<string, string> = {
    'Consolidation': 'Đông đặc',
    'Atelectasis': 'Xẹp phổi',
    'Effusion': 'Tràn dịch',
    'Pneumonia': 'Viêm phổi',
    'Lung Opacity': 'Mờ phổi',
    'Infiltration': 'Thâm nhiễm',
    'No Finding': 'Bình thường',
  };

  return (
    <div className="border-t border-zinc-800 bg-zinc-900">
      {/* Header row */}
      <div className="flex items-center justify-between px-2.5 py-1.5">
        <div className="flex items-center gap-1.5">
          <Cpu className="w-3 h-3 text-indigo-400" />
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wide">AI X-quang</span>
          {state === 'done' && result && (
            <span className="text-[10px] bg-indigo-900/60 text-indigo-300 px-1.5 py-0.5 rounded font-mono">
              {LABEL_VI[result.top_finding] ?? result.top_finding}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {state === 'done' && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
          <button
            onClick={analyze}
            disabled={state === 'loading'}
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-sm transition-colors"
          >
            {state === 'loading'
              ? <><Loader2 className="w-3 h-3 animate-spin" /> Đang phân tích…</>
              : state === 'done'
              ? <><RefreshCw className="w-3 h-3" /> Chạy lại</>
              : <><Cpu className="w-3 h-3" /> Phân tích</>}
          </button>
        </div>
      </div>

      {/* Error */}
      {state === 'error' && (
        <div className="px-3 pb-2 text-[10px] text-red-400">{error}</div>
      )}

      {/* Results */}
      {state === 'done' && result && expanded && (
        <div className="px-2.5 pb-3 flex flex-col gap-2">
          {/* Probability bars */}
          <div className="flex flex-col gap-1">
            {result.predictions.slice(0, 5).map(p => (
              <div key={p.label} className="flex items-center gap-2">
                <span className="text-[9px] text-zinc-400 w-20 shrink-0 truncate">{LABEL_VI[p.label] ?? p.label}</span>
                <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.round(p.probability * 100)}%`,
                      backgroundColor: p.probability > 0.6 ? '#f97316' : p.probability > 0.3 ? '#eab308' : '#6b7280',
                    }}
                  />
                </div>
                <span className="text-[9px] text-zinc-400 w-7 text-right shrink-0">
                  {Math.round(p.probability * 100)}%
                </span>
              </div>
            ))}
          </div>

          {/* Heatmap tabs */}
          {Object.keys(result.heatmaps).length > 0 && (
            <div>
              <div className="flex gap-1 mb-1.5">
                {Object.keys(result.heatmaps).map(cls => (
                  <button
                    key={cls}
                    onClick={() => setHeatmapTab(cls)}
                    className={`text-[9px] px-1.5 py-0.5 rounded-sm transition-colors ${
                      heatmapTab === cls
                        ? 'bg-indigo-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {LABEL_VI[cls] ?? cls}
                  </button>
                ))}
              </div>
              {result.heatmaps[heatmapTab] && (
                <img
                  src={`data:image/jpeg;base64,${result.heatmaps[heatmapTab]}`}
                  alt={`Heatmap ${heatmapTab}`}
                  className="w-full rounded-sm border border-zinc-700"
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ImagePanel({
  widthPct, sample, caseInfo, episodeId,
  hoveredIdx, onHoverIdx, focusedIdx, onFocusIdx, onFullscreen, onCollapse,
}: {
  widthPct: number; sample: PcxrSample; caseInfo: CaseInfo; episodeId: string;
  hoveredIdx: number | null; onHoverIdx: (i: number | null) => void;
  focusedIdx: number | null; onFocusIdx: (i: number | null) => void;
  onFullscreen: () => void;
  onCollapse?: () => void;
}) {
  const [infoOpen, setInfoOpen] = useState(true);

  return (
    // Panel fills the flex row height (stretch), never scrolls — image adapts to fit
    <div style={{ width: `${widthPct}%` }} className="shrink-0 flex flex-col gap-2 min-h-0 h-full">

      {/* X-ray card — flex-1 so it takes all remaining height after patient info */}
      <div className="border border-zinc-800 rounded-sm bg-black overflow-hidden flex flex-col flex-1 min-h-0">
        {/* Toolbar — fixed height */}
        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-zinc-800 bg-zinc-900 shrink-0">
          <span className="text-[10px] font-mono text-zinc-400">{sample.imageId}</span>
          <div className="flex items-center gap-2">
            {focusedIdx !== null && (
              <button
                onClick={() => onFocusIdx(null)}
                className="text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors px-2 py-0.5 border border-zinc-700 rounded-sm"
              >
                Reset zoom
              </button>
            )}
            <button onClick={onFullscreen} title="Phóng to" className="p-0.5 text-zinc-500 hover:text-zinc-300 transition-colors">
              <Maximize2 className="w-3 h-3" />
            </button>
            {onCollapse && (
              <button
                onClick={onCollapse}
                title="Ẩn ảnh"
                className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:text-zinc-200 border border-zinc-700 rounded-sm transition-colors"
              >
                <Minimize2 className="w-3 h-3" />Ẩn
              </button>
            )}
          </div>
        </div>

        {/* Viewport — flex-1 fills remaining card height; ResizeObserver draws max square inside */}
        <div className="flex-1 min-h-0">
          <XrayViewport sample={sample} hoveredIdx={hoveredIdx} onHoverIdx={onHoverIdx} focusedIdx={focusedIdx} onFocusIdx={onFocusIdx} />
        </div>

        {/* CXR AI Analysis */}
        <CxrAnalysisPanel episodeId={episodeId} imgSrc={sample.imgSrc} />

        {/* Annotation legend — fixed height below image */}
        {sample.annotations.length > 0 && (
          <div className="px-2.5 py-1.5 border-t border-zinc-800 flex flex-wrap gap-1.5 shrink-0">
            {sample.annotations.map((ann, i) => {
              const col = catColor(ann.categoryId);
              const isFocused = focusedIdx === i;
              return (
                <button key={ann.id}
                  onMouseEnter={() => onHoverIdx(i)} onMouseLeave={() => onHoverIdx(null)}
                  onClick={() => onFocusIdx(focusedIdx === i ? null : i)}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded-sm border transition-colors text-[9px] ${col.border} ${isFocused ? col.bgHover : ''}`}
                >
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: col.dot }} />
                  <span className="text-zinc-400">{catShort(ann.categoryId, ann.category)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Patient info — collapsible */}
      <div className="border border-border rounded-sm bg-surface shrink-0">
        <button onClick={() => setInfoOpen(o => !o)}
          className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-background-secondary transition-colors">
          <div className="flex items-center gap-1.5">
            <User className="w-3 h-3 text-text-tertiary" />
            <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Thông tin ca</span>
          </div>
          <ChevronRight className={`w-3 h-3 text-text-tertiary transition-transform duration-150 ${infoOpen ? 'rotate-90' : ''}`} />
        </button>
        {infoOpen && (
          <div className="px-3 pb-2.5 grid grid-cols-2 gap-x-4 gap-y-2">
            {[
              { icon: User,         v: `${caseInfo.age} · ${caseInfo.gender}`, l: 'BN' },
              { icon: Calendar,     v: caseInfo.date,                           l: 'Ngày' },
              { icon: Activity,     v: caseInfo.spo2,                           l: 'SpO₂' },
              { icon: FlaskConical, v: caseInfo.crp,                            l: 'CRP' },
              { icon: Stethoscope,  v: caseInfo.symptoms,                       l: 'T/c' },
            ].map(f => (
              <div key={f.l} className="flex items-start gap-1.5 min-w-0">
                <f.icon className="w-3 h-3 text-text-tertiary mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[9px] text-text-tertiary">{f.l}</p>
                  <p className="text-[11px] text-text-primary font-medium leading-tight mt-0.5 truncate">{f.v}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Fullscreen viewer ─────────────────────────────────────────────────────
function FullscreenViewer({ sample, caseInfo, hoveredIdx, onHoverIdx, onClose }: {
  sample: PcxrSample; caseInfo: CaseInfo; hoveredIdx: number | null; onHoverIdx: (i: number | null) => void; onClose: () => void;
}) {
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'f') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-zinc-950 z-50 flex flex-col animate-fade-in">
      <div className="flex items-center justify-between px-5 py-2 border-b border-zinc-800 shrink-0 animate-slide-down">
        <div className="flex items-center gap-4">
          <span className="text-sm font-mono text-zinc-200">{sample.imageId}</span>
          <span className="text-xs text-zinc-500">{caseInfo.age} · {caseInfo.gender} · {caseInfo.date}</span>
        </div>
        <button onClick={onClose} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-500 rounded-sm px-2.5 py-1 transition-colors">
          <span>Esc</span><X className="w-3.5 h-3.5" />
        </button>
      </div>
      {/* flex-1 min-h-0 gives XrayViewport a defined height so ResizeObserver works correctly */}
      <div className="flex-1 min-h-0 p-4 animate-scale-in">
        <div className="border border-zinc-800 rounded-sm overflow-hidden h-full">
          <XrayViewport sample={sample} hoveredIdx={hoveredIdx} onHoverIdx={onHoverIdx} focusedIdx={focusedIdx} onFocusIdx={setFocusedIdx} />
        </div>
      </div>
      <div className="shrink-0 border-t border-zinc-800 px-5 py-2 flex flex-wrap items-center gap-2 animate-slide-up">
        <span className="text-[10px] text-zinc-600 mr-1">Hover để highlight:</span>
        {sample.annotations.map((ann, i) => {
          const col = catColor(ann.categoryId);
          return (
            <button key={ann.id} onMouseEnter={() => onHoverIdx(i)} onMouseLeave={() => onHoverIdx(null)}
              className={`flex items-center gap-2 px-3 py-1 rounded-sm border transition-colors ${
                hoveredIdx === i ? `bg-zinc-800 ${col.border}` : 'border-zinc-800 hover:border-zinc-700'
              }`}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: col.dot }} />
              <span className="text-xs text-zinc-300">{catShort(ann.categoryId, ann.category)}</span>
              <span className="text-[10px] font-mono text-zinc-500">{(0.75 * 100).toFixed(0)}%</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step 1: Detection ─────────────────────────────────────────────────────
function DetectionPanel({ sample, hoveredIdx, onHoverIdx, focusedIdx, onFocusIdx, onNext }: {
  sample: PcxrSample;
  hoveredIdx: number | null;
  onHoverIdx: (i: number | null) => void;
  focusedIdx: number | null;
  onFocusIdx: (i: number | null) => void;
  onNext: () => void;
}) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDetect = () => {
    setIsGenerating(true);
    setTimeout(() => setIsGenerating(false), 1500);
  };

  if (isGenerating) {
    return (
      <div className="flex flex-col gap-3 flex-1">
        <div className="border border-border rounded-sm bg-surface">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs font-semibold text-text-primary">Kết quả phát hiện bất thường</span>
            <span className="text-[10px] font-mono text-text-tertiary flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />Đang phân tích...
            </span>
          </div>
          <DetectionSkeleton />
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 flex-1">
      <div className="border border-border rounded-sm bg-surface">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-xs font-semibold text-text-primary">Kết quả phát hiện bất thường</span>
          <span className="text-[10px] font-mono text-text-tertiary bg-background-tertiary border border-border px-1.5 py-0.5 rounded-sm">
            {sample.annotations.length} findings · PCXR v1.2 · {sample.imageId}
          </span>
        </div>
        <div className="divide-y divide-border">
          {sample.annotations.map((ann, i) => {
            const col = catColor(ann.categoryId);
            const score = 0.75;
            const isHot = hoveredIdx === i;
            const isFocused = focusedIdx === i;
            return (
              <div key={ann.id}
                onMouseEnter={() => onHoverIdx(i)} onMouseLeave={() => onHoverIdx(null)}
                onClick={() => onFocusIdx(focusedIdx === i ? null : i)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isHot || isFocused ? 'bg-background-secondary' : ''}`}>
                <div className="w-0.5 self-stretch min-h-8 rounded-full shrink-0" style={{ backgroundColor: col.dot }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-text-primary truncate">{catShort(ann.categoryId, ann.category)}</p>
                  <p className="text-[10px] text-text-tertiary mt-0.5 truncate">{ann.category}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold font-mono text-text-primary">{(score * 100).toFixed(0)}%</p>
                  <p className="text-[10px] text-text-tertiary">tin cậy</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border border-semantic-warning/30 rounded-sm bg-semantic-warning/5 px-3 py-2 flex items-start gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-semantic-warning shrink-0 mt-0.5" />
        <p className="text-xs text-text-secondary leading-relaxed">
          Click vào finding để zoom vào vùng đó. Click lại hoặc "Reset zoom" để quay về. Kết quả cần bác sĩ xem xét trực tiếp.
        </p>
      </div>

      <div className="flex gap-2">
        <button onClick={handleDetect}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-background-secondary border border-border rounded-sm text-xs font-medium text-text-secondary hover:bg-background-tertiary transition-colors">
          <FlaskConical className="w-3.5 h-3.5" />Phân tích lại
        </button>
        <button onClick={onNext}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-brand-primary text-white text-xs font-semibold rounded-sm hover:opacity-90 transition-opacity">
          Yêu cầu CAE giải thích <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Step 2: Explain ───────────────────────────────────────────────────────
function ExplainPanel({
  episodeId, sample, onNext, onCitation, onCitationsLoaded, onStructuredCitationsLoaded, focusedIdx, onFocusIdx,
}: {
  episodeId: string;
  sample: PcxrSample;
  onNext: () => void;
  onCitation: (n: number) => void;
  onCitationsLoaded: (cits: Citation[]) => void;
  onStructuredCitationsLoaded?: (cits: CitationAnchor[]) => void;
  focusedIdx: number | null;
  onFocusIdx: (i: number | null) => void;
}) {
  const [feedback, setFeedback] = useState<'accepted' | 'rejected' | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [showFindings, setShowFindings] = useState(false);
  const [activeCitationId, setActiveCitationId] = useState<string | null>(null);
  const [hoveredCitationId, setHoveredCitationId] = useState<string | null>(null);
  // DB restore state
  const [restoredBlocks, setRestoredBlocks] = useState<RenderableBlock[]>([]);
  const [restoredCitations, setRestoredCitations] = useState<CitationAnchor[]>([]);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoredAt, setRestoredAt] = useState<string | null>(null);

  const findingIds = sample.annotations.map((annotation) => String(annotation.id));
  const {
    isStreaming,
    blocks: streamBlocks,
    citations: streamCitations,
    content,
    error,
    startExplain,
    abort,
    reset,
  } = useCAEStream();

  // Use streamed results if available, else fall back to DB-restored results
  const blocks = streamBlocks.length > 0 ? streamBlocks : restoredBlocks;
  const citations = streamCitations.length > 0 ? streamCitations : restoredCitations;

  const liveCitations = useMemo(
    () => citations.map((citation, index) => mapStructuredCitation(citation, index)),
    [citations]
  );
  const narrativeSummary = blocks.find((block) => block.type === 'summary');
  const narrativeBody = useMemo(
    () => blocks
      .filter((block): block is Extract<RenderableBlock, { type: 'paragraph' }> => block.type === 'paragraph')
      .map((block) => block.text)
      .join(' '),
    [blocks]
  );
  const narrativeHighlights = useMemo(
    () => extractNarrativeHighlights(narrativeBody || (narrativeSummary?.type === 'summary' ? narrativeSummary.text : '')),
    [narrativeBody, narrativeSummary]
  );
  const activeFinding = focusedIdx !== null ? sample.annotations[focusedIdx] ?? null : null;
  const status = isRestoring ? 'restoring' : !hasStarted ? 'idle' : isStreaming ? 'streaming' : error ? 'error' : 'done';

  // DB restore: on mount check for recent explain run (max 8h)
  useEffect(() => {
    let cancelled = false;
    async function tryRestore() {
      setIsRestoring(true);
      try {
        const run = await getLatestAiRun(episodeId, 'explain', 10080);
        if (!cancelled && run && (run.blocks as RenderableBlock[]).length > 0) {
          setRestoredBlocks(run.blocks as RenderableBlock[]);
          setRestoredCitations((run.citations ?? []) as CitationAnchor[]);
          setRestoredAt(run.completed_at ?? run.created_at);
          setHasStarted(true);
        }
      } finally {
        if (!cancelled) setIsRestoring(false);
      }
    }
    tryRestore();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeId]);

  useEffect(() => {
    onCitationsLoaded(liveCitations);
  }, [liveCitations, onCitationsLoaded]);

  useEffect(() => {
    onStructuredCitationsLoaded?.(citations);
  }, [citations, onStructuredCitationsLoaded]);

  // NOTE: no abort/reset on unmount — component stays mounted (CSS hidden) for tab-switch persistence

  const handleRun = async () => {
    // Clear restored state so stream results take over
    setRestoredBlocks([]);
    setRestoredCitations([]);
    setRestoredAt(null);
    setHasStarted(true);
    setFeedback(null);
    onCitationsLoaded([]);
    onStructuredCitationsLoaded?.([]);
    reset();
    await startExplain(episodeId, buildDetectionPayload(episodeId, sample.annotations), { findingIds });
  };

  const handleCitationSelect = (citationId: string) => {
    setActiveCitationId(citationId);
    // Spatial focus: resolve findingIds -> annotation index -> onFocusIdx
    const anchor = citations.find(c => c.citationId === citationId);
    if (anchor?.findingIds && anchor.findingIds.length > 0) {
      const foundIndex = sample.annotations.findIndex(a => String(a.id) === anchor.findingIds![0]);
      if (foundIndex >= 0) {
        onFocusIdx(foundIndex);
      }
    }
  };

  return (
    <div className="flex flex-col gap-2 flex-1 min-h-0">

      {/* ── Restoring from DB ────────────────────────────────────────────── */}
      {status === 'restoring' && (
        <div className="flex-1 flex items-center justify-center border border-border rounded-sm bg-surface">
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Đang khôi phục kết quả...
          </div>
        </div>
      )}

      {/* ── Idle ─────────────────────────────────────────────────────────── */}
      {status === 'idle' && (
        <div className="flex-1 flex flex-col items-center justify-center border border-border rounded-sm bg-surface p-8 gap-5">
          <div className="text-center space-y-1 max-w-sm">
            <p className="text-sm font-semibold text-text-primary">
              Giải thích lâm sàng
            </p>
            <p className="text-xs text-text-secondary leading-relaxed">
              CAE sẽ ghép narrative cho {sample.annotations.length} finding, đối chiếu guideline và gắn citation vào từng điểm bất thường.
            </p>
          </div>
          <button
            onClick={handleRun}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-primary text-white text-xs font-semibold rounded-sm hover:opacity-90 transition-opacity"
          >
            <Play className="w-3.5 h-3.5" />
            Tạo narrative
          </button>
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {status === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 border border-border rounded-sm bg-surface p-8 text-center">
          <AlertTriangle className="w-6 h-6 text-semantic-warning" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-text-primary">Narrative chưa hoàn tất</p>
            <p className="text-xs text-text-secondary max-w-md leading-relaxed">{error}</p>
          </div>
          <button
            onClick={handleRun}
            className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white text-xs font-semibold rounded-sm hover:opacity-90"
          >
            <RefreshCw className="w-3.5 h-3.5" />Thử lại
          </button>
        </div>
      )}

      {/* ── Streaming ────────────────────────────────────────────────────── */}
      {status === 'streaming' && (
        <div className="flex-1 border border-border rounded-sm bg-surface flex flex-col min-h-0">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-primary" />
            <span className="text-xs text-text-secondary">CAE đang ghép narrative...</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 min-h-0 space-y-2">
            {content ? (
              <p className="text-xs text-text-primary leading-relaxed whitespace-pre-wrap">{content}</p>
            ) : (
              <div className="space-y-2 animate-pulse">
                <div className="h-3 w-3/4 bg-background-tertiary rounded" />
                <div className="h-3 w-full bg-background-tertiary rounded" />
                <div className="h-3 w-[90%] bg-background-tertiary rounded" />
                <div className="h-3 w-[85%] bg-background-tertiary rounded" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Done ─────────────────────────────────────────────────────────── */}
      {status === 'done' && (
        <div className="flex flex-row flex-1 min-h-0">
        <div className="border border-border rounded-sm bg-surface flex flex-col flex-1 min-h-0">
          {/* Header */}
          <div className="px-3 py-2 border-b border-border shrink-0 flex items-center gap-2">
            <span className="text-xs font-semibold text-text-primary flex-1">Narrative</span>

            {/* Restored from DB badge */}
            {restoredAt && streamBlocks.length === 0 && (
              <span className="text-[10px] text-text-tertiary border border-border rounded-sm px-1.5 py-0.5 flex items-center gap-1">
                <Database className="w-2.5 h-2.5" />
                {new Date(restoredAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}

            {/* Findings toggle */}
            <button
              onClick={() => setShowFindings(v => !v)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-sm text-[11px] font-medium border transition-colors ${
                showFindings
                  ? 'border-brand-primary/30 bg-brand-light/10 text-brand-primary'
                  : 'border-border bg-background-secondary text-text-secondary hover:border-brand-primary/30 hover:text-text-primary'
              }`}
            >
              <Activity className="w-3 h-3" />
              {sample.annotations.length} findings
            </button>

            {/* Feedback badge */}
            {feedback && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-sm border ${
                feedback === 'accepted'
                  ? 'border-semantic-success/30 bg-semantic-success/10 text-semantic-success'
                  : 'border-semantic-error/30 bg-semantic-error/10 text-semantic-error'
              }`}>
                {feedback === 'accepted' ? 'Chấp nhận' : 'Cần sửa'}
              </span>
            )}
          </div>

          {/* Findings drawer — collapsible horizontal strip */}
          {showFindings && (
            <div className="border-b border-border bg-background-secondary shrink-0 px-3 py-2">
              <div className="flex gap-2 overflow-x-auto pb-0.5">
                {sample.annotations.map((annotation, index) => (
                  <button
                    key={annotation.id}
                    onClick={() => onFocusIdx(focusedIdx === index ? null : index)}
                    className={`shrink-0 rounded-sm border px-2.5 py-1.5 text-left transition-colors ${
                      focusedIdx === index
                        ? 'border-brand-primary bg-brand-light/10'
                        : 'border-border bg-surface hover:border-brand-primary/50'
                    }`}
                  >
                    <p className="text-[11px] font-medium text-text-primary whitespace-nowrap">{catShort(annotation.categoryId, annotation.category)}</p>
                    <p className="text-[10px] text-text-tertiary mt-0.5 whitespace-nowrap">{annotation.category}</p>
                  </button>
                ))}
                {liveCitations.length > 0 && (
                  <>
                    <div className="w-px bg-border shrink-0 mx-1" />
                    {liveCitations.map((citation) => (
                      <button
                        key={citation.num}
                        onClick={() => onCitation(citation.num)}
                        className="shrink-0 rounded-sm border border-border bg-surface px-2.5 py-1.5 text-left hover:border-brand-primary/50 hover:bg-brand-light/10 transition-colors max-w-[180px]"
                      >
                        <p className="text-[10px] font-bold text-brand-primary whitespace-nowrap">[{citation.num}] <span className="font-medium text-text-primary truncate">{citation.ref}</span></p>
                        <p className="text-[10px] text-text-tertiary mt-0.5 truncate">{citation.passage}</p>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Narrative content */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            {blocks.length > 0 ? (
              <BlockRenderer
                blocks={blocks}
                onCitationClick={handleCitationSelect}
                onCitationHover={setHoveredCitationId}
                hoveredCitationId={hoveredCitationId}
              />
            ) : (
              <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{content}</p>
            )}
          </div>

          {/* Footer: feedback + actions */}
          <div className="px-3 py-2 border-t border-border shrink-0 flex items-center gap-2">
            <button
              onClick={() => setFeedback('accepted')}
              className={`px-2.5 py-1 rounded-sm text-[11px] font-semibold border transition-colors ${
                feedback === 'accepted'
                  ? 'bg-semantic-success text-white border-semantic-success'
                  : 'border-border text-text-secondary hover:border-semantic-success/50 hover:text-semantic-success hover:bg-semantic-success/5'
              }`}
            >
              Chấp nhận
            </button>
            <button
              onClick={() => setFeedback('rejected')}
              className={`px-2.5 py-1 rounded-sm text-[11px] font-semibold border transition-colors ${
                feedback === 'rejected'
                  ? 'bg-semantic-error text-white border-semantic-error'
                  : 'border-border text-text-secondary hover:border-semantic-error/50 hover:text-semantic-error hover:bg-semantic-error/5'
              }`}
            >
              Cần sửa
            </button>
            <button
              onClick={() => { setFeedback(null); handleRun(); }}
              className="flex items-center gap-1 text-[10px] text-text-tertiary hover:text-text-primary transition-colors"
            >
              <RefreshCw className="w-3 h-3" />Chạy lại
            </button>
            <button
              onClick={onNext}
              className="flex items-center gap-1.5 ml-auto px-3 py-1.5 bg-brand-primary text-white text-[11px] font-semibold rounded-sm hover:opacity-90 transition-opacity"
            >
              Tiếp tục — Sinh nháp <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
        {/* Evidence Rail — only when citations available */}
        {citations.length > 0 && (
          <EvidenceRail
            citations={citations}
            activeCitationId={activeCitationId}
            onCitationClick={handleCitationSelect}
            onCitationHover={setHoveredCitationId}
          />
        )}
        </div>
      )}
    </div>
  );
}

// ─── Step 3: Draft ─────────────────────────────────────────────────────────
function DraftPanel({
  episodeId,
  sample,
  caseInfo,
  highlightedFieldKey,
  onCitation,
  onCitationsLoaded,
  onStructuredCitationsLoaded,
}: {
  episodeId: string;
  sample: PcxrSample;
  caseInfo: CaseInfo;
  highlightedFieldKey: string | null;
  onCitation: (n: number) => void;
  onCitationsLoaded: (cits: Citation[]) => void;
  onStructuredCitationsLoaded?: (cits: CitationAnchor[]) => void;
}) {
  const [fields, setFields] = useState<DraftField[]>([]);
  const [approved, setApproved] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [restoredDraftId, setRestoredDraftId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const findingIds = sample.annotations.map((annotation) => String(annotation.id));
  const {
    isStreaming,
    blocks,
    citations,
    content,
    error,
    startDraft,
    abort,
    reset,
  } = useCAEStream();

  // Restore latest draft from DB on mount (persist across page reloads)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsRestoring(true);
      try {
        const saved = await getLatestDraft(episodeId);
        if (!cancelled && saved && saved.fields?.length > 0) {
          setFields(mapDraftFields(saved.fields as Parameters<typeof mapDraftFields>[0]));
          setHasStarted(true);
          setRestoredDraftId(saved.draft_id);
          if (saved.status === 'approved') setApproved(true);
        }
      } finally {
        if (!cancelled) setIsRestoring(false);
      }
    })();
    return () => { cancelled = true; };
  }, [episodeId]);

  const streamedFields = useMemo(() => mapPatchBlocksToDraftFields(blocks), [blocks]);
  const liveCitations = useMemo(
    () => citations.map((citation, index) => mapStructuredCitation(citation, index)),
    [citations]
  );
  const status = !hasStarted
    ? (isRestoring ? 'restoring' : 'idle')
    : isStreaming ? 'generating' : error ? 'error' : 'done';

  useEffect(() => {
    if (streamedFields.length > 0) {
      setFields(streamedFields);
    }
  }, [streamedFields]);

  // When a new draft stream completes: invalidate cache AND fetch the draft_id
  // that the backend just saved — so the "Lưu" button can PATCH right away.
  useEffect(() => {
    if (hasStarted && !isStreaming && !error && streamedFields.length > 0) {
      invalidateDraftCache(episodeId);
      if (!restoredDraftId) {
        getLatestDraft(episodeId).then((saved) => {
          if (saved?.draft_id) setRestoredDraftId(saved.draft_id);
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStarted, isStreaming, error, streamedFields.length, episodeId]);

  useEffect(() => {
    onCitationsLoaded(liveCitations);
  }, [liveCitations, onCitationsLoaded]);

  useEffect(() => {
    onStructuredCitationsLoaded?.(citations);
  }, [citations, onStructuredCitationsLoaded]);

  useEffect(() => () => {
    abort();
    reset();
  }, [abort, reset]);

  useEffect(() => {
    if (!highlightedFieldKey) return;

    const matchedField = fields.find(field => matchesFieldKey(field, highlightedFieldKey));
    if (!matchedField) {
      return;
    }

    fieldRefs.current[matchedField.key]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [fields, highlightedFieldKey]);

  const handleGenerate = async () => {
    setHasStarted(true);
    setApproved(false);
    setFields([]);
    setRestoredDraftId(null);
    invalidateDraftCache(episodeId);
    onCitationsLoaded([]);
    onStructuredCitationsLoaded?.([]);
    await startDraft(episodeId, 'default', buildDetectionPayload(episodeId, sample.annotations), { findingIds });
  };

  const handleCitationSelect = (citationId: string) => {
    const parsedId = Number.parseInt(citationId, 10);
    if (Number.isFinite(parsedId)) {
      onCitation(parsedId);
    }
  };

  const overviewBlocks = blocks.filter((block) => block.type !== 'field_patch');
  const invalidReviewFields = fields.filter((field) => field.status !== 'valid');
  const hasBlockedField = fields.some((field) => field.status === 'policy_blocked');

  const pickFieldValue = (...keywords: string[]) => {
    const lowerKeywords = keywords.map((k) => k.toLowerCase());
    const match = fields.find((field) => {
      const target = `${field.key} ${field.label}`.toLowerCase();
      return lowerKeywords.some((keyword) => target.includes(keyword));
    });
    return toFieldString(match?.value).trim();
  };

  const requiredSections = [
    { label: 'Lý do chỉ định chụp', value: pickFieldValue('lý do', 'chief_complaint') },
    { label: 'Mô tả hình ảnh', value: pickFieldValue('x-quang', 'detection', 'mô tả') },
    { label: 'Kết luận', value: pickFieldValue('đánh giá', 'impression', 'kết luận') },
  ];
  const missingRequiredSections = requiredSections.filter((section) => !section.value);
  const canFinalize = !hasBlockedField && missingRequiredSections.length === 0;
  const finalizeBlockReason = hasBlockedField
    ? 'Còn field bị policy chặn, chưa thể ký chính thức.'
    : missingRequiredSections.length > 0
      ? `Thiếu mục bắt buộc: ${missingRequiredSections.map((section) => section.label).join(', ')}.`
      : null;

  const buildReportData = (mode: 'draft' | 'official') => {
    const isOfficial = mode === 'official' && canFinalize;
    const fallback = (v: string) => String(v ?? '').trim() || 'Chưa ghi nhận trong hồ sơ tại thời điểm lập báo cáo.';
    return {
      isOfficial,
      generatedAt: new Date().toLocaleString('vi-VN'),
      indication:     fallback(pickFieldValue('lý do', 'chief_complaint')),
      vitals:         fallback(pickFieldValue('sinh hiệu', 'vitals')),
      labs:           fallback(pickFieldValue('xét nghiệm', 'labs')),
      findings:       fallback(pickFieldValue('x-quang', 'detection', 'mô tả') || sample.annotations.map((a) => `${catShort(a.categoryId, a.category)} (${Math.round(0.75 * 100)}%)`).join('; ')),
      impression:     fallback(pickFieldValue('đánh giá', 'kết luận', 'impression')),
      recommendation: fallback(pickFieldValue('đề xuất', 'xử lý', 'recommend')),
      doctorNote:     fallback(pickFieldValue('ghi chú', 'note')),
    };
  };

  /** Open the print/preview page in a new tab — browser handles PDF via Ctrl+P */
  const handlePrint = (mode: 'draft' | 'official' = 'draft') => {
    const d = buildReportData(mode);
    const detections = sample.annotations.map((a) => ({
      label: catShort(a.categoryId, a.category),
      confidence: `${Math.round(0.75 * 100)}%`,
    }));
    const auditFields = fields.map((f) => ({
      label: f.label, source: f.source, status: f.status,
      provenance: f.provenance.length,
      value: (f.value ?? '').slice(0, 180),
    }));
    const params = new URLSearchParams({
      imageId:        sample.imageId,
      age:            caseInfo.age,
      gender:         caseInfo.gender,
      date:           caseInfo.date,
      episodeId,
      official:       d.isOfficial ? '1' : '0',
      indication:     encodeURIComponent(d.indication),
      vitals:         encodeURIComponent(d.vitals),
      labs:           encodeURIComponent(d.labs),
      findings:       encodeURIComponent(d.findings),
      impression:     encodeURIComponent(d.impression),
      recommendation: encodeURIComponent(d.recommendation),
      doctorNote:     encodeURIComponent(d.doctorNote),
      imgSrc:         sample.imgSrc,
      detections:     encodeURIComponent(JSON.stringify(detections)),
      fields:         encodeURIComponent(JSON.stringify(auditFields)),
    });
    window.open(`/cases/${episodeId}/print?${params.toString()}`, '_blank');
  };

  /** Build inline HTML for srcdoc preview — instant, no blob URL, native font rendering */
  const handlePreview = (mode: 'draft' | 'official' = 'draft') => {
    const d = buildReportData(mode);
    const esc = (v: string) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const statusColor = d.isOfficial ? '#166534' : '#b45309';
    const statusText  = d.isOfficial ? 'BẢN CHÍNH THỨC — ĐÃ DUYỆT' : 'BẢN NHÁP — CHƯA CÓ GIÁ TRỊ PHÁP LÝ';

    const detectionRows = sample.annotations.map((ann, i) => `
      <tr>
        <td>${i + 1}</td><td>${esc(catShort(ann.categoryId, ann.category))}</td>
        <td>${Math.round(0.75 * 100)}%</td><td>[${ann.bbox.join(', ')}]</td>
      </tr>`).join('');

    const fieldRows = fields.map((f, i) => {
      const val = (f.value ?? '').length > 160 ? `${(f.value ?? '').slice(0, 160)}…` : (f.value ?? '');
      return `<tr>
        <td>${i + 1}</td><td>${esc(f.label)}</td><td>${esc(f.source)}</td>
        <td>${esc(f.status)}</td><td>${f.provenance.length}</td>
        <td style="max-width:160px;word-break:break-word;">${esc(val || '—')}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8">
<style>
  @page { size: A4; margin: 20mm 15mm 20mm 30mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 13pt; color: #111; background: #f3f4f6; margin: 0; padding: 20px 0; }
  .page { background: #fff; width: 794px; min-height: 1123px; margin: 0 auto 32px; padding: 28mm 20mm 20mm 28mm; box-shadow: 0 2px 16px rgba(0,0,0,.15); position: relative; }
  .draft-wm { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-40deg); font-size: 80pt; font-weight: 900; color: rgba(0,0,0,.04); white-space: nowrap; pointer-events: none; }
  h1 { font-size: 15pt; font-weight: 700; text-align: center; text-transform: uppercase; margin: 8pt 0 3pt; }
  .status { text-align: center; font-size: 10pt; font-weight: 700; color: ${statusColor}; margin-bottom: 12pt; }
  .sec-title { font-size: 11pt; font-weight: 700; margin: 10pt 0 3pt; }
  p { margin: 2pt 0 5pt; line-height: 1.5; }
  table.info { width: 100%; border-collapse: collapse; margin: 8pt 0 12pt; font-size: 11pt; }
  table.info td { border: 1px solid #94a3b8; padding: 5pt 7pt; }
  table.data { width: 100%; border-collapse: collapse; font-size: 10pt; margin: 6pt 0 12pt; }
  table.data th { border: 1px solid #94a3b8; background: #f1f5f9; padding: 3pt 5pt; text-align: left; }
  table.data td { border: 1px solid #cbd5e1; padding: 3pt 5pt; vertical-align: top; }
  .hdr { display: flex; justify-content: space-between; font-size: 11pt; margin-bottom: 2pt; }
  .sign { display: flex; justify-content: space-around; margin-top: 20pt; gap: 16pt; }
  .sign-col { width: 44%; text-align: center; }
  .sign-col .role { font-size: 11pt; font-weight: 700; text-transform: uppercase; letter-spacing: .3pt; margin-bottom: 2pt; }
  .sign-col .note { font-size: 9.5pt; color: #475569; font-style: italic; margin-bottom: 0; }
  .sign-col .date-line { font-size: 9.5pt; color: #475569; margin-bottom: 2pt; }
  .sign-line { border-top: 1px solid #334155; margin-top: 32pt; padding-top: 4pt; font-size: 10pt; text-align: center; }
  .xray-block {
    display: flex; gap: 16pt; align-items: flex-start;
    margin: 6pt 0 12pt;
    background: #f8fafc; border: 1px solid #e2e8f0;
    border-radius: 4pt; padding: 10pt;
  }
  .xray-fig { flex-shrink: 0; text-align: center; }
  .xray-fig img {
    width: 96pt; height: 96pt; object-fit: cover;
    border: 1px solid #94a3b8; display: block;
    border-radius: 2pt;
  }
  .xray-fig figcaption { font-size: 7.5pt; color: #64748b; margin-top: 4pt; font-style: italic; }
  .xray-text { flex: 1; font-size: 12pt; line-height: 1.65; color: #111; }
  @media print { body { background: #fff; padding: 0; } .page { box-shadow: none; margin: 0; width: auto; min-height: auto; } .page-break { page-break-before: always; } }
</style></head><body>
<div class="page">
  ${!d.isOfficial ? '<div class="draft-wm">NHÁP</div>' : ''}
  <div class="hdr">
    <div><strong>BỆNH VIỆN NHI TRUNG ƯƠNG</strong><br><small>Khoa Chẩn đoán hình ảnh</small></div>
    <div style="text-align:right;font-size:11pt;">Số phiếu: XR-${esc(sample.imageId.toUpperCase())}<br>Mã hồ sơ: EP-${esc(episodeId)}</div>
  </div>
  <hr style="border-top:1.5px solid #64748b;margin:5pt 0;">
  <h1>Phiếu Báo Cáo X-Quang Lồng Ngực</h1>
  <div class="status">${statusText}</div>

  <div class="sec-title">I. THÔNG TIN HÀNH CHÍNH</div>
  <table class="info"><tbody>
    <tr><td><strong>Bệnh nhân:</strong> ${esc(caseInfo.age)} · ${esc(caseInfo.gender)}</td><td><strong>Mã hình:</strong> ${esc(sample.imageId)}</td></tr>
    <tr><td><strong>Ngày chụp:</strong> ${esc(caseInfo.date)}</td><td><strong>Tạo báo cáo:</strong> ${esc(d.generatedAt)}</td></tr>
    <tr><td>Nguồn: CAE · WebRAG AI Engine</td><td>Trạng thái: ${esc(d.isOfficial ? 'Chính thức' : 'Nháp')}</td></tr>
  </tbody></table>

  <div class="sec-title">II. CHỈ ĐỊNH VÀ DỮ LIỆU LÂM SÀNG</div>
  <p><strong>Lý do chỉ định:</strong> ${esc(d.indication)}</p>
  <p><strong>Sinh hiệu:</strong> ${esc(d.vitals)}</p>
  <p><strong>Xét nghiệm:</strong> ${esc(d.labs)}</p>

  <div class="sec-title">III. MÔ TẢ HÌNH ẢNH</div>
  <div class="xray-block">
    <figure class="xray-fig">
      <img src="${esc(sample.imgSrc)}" alt="X-quang">
      <figcaption>Hình X-quang · ${esc(sample.imageId)}</figcaption>
    </figure>
    <div class="xray-text">${esc(d.findings)}</div>
  </div>

  <div class="sec-title">IV. KẾT LUẬN</div>
  <p>${esc(d.impression)}</p>

  <div class="sec-title">V. ĐỀ NGHỊ / HƯỚNG XỬ TRÍ</div>
  <p>${esc(d.recommendation)}</p>

  <div class="sec-title">VI. GHI CHÚ BÁC SĨ</div>
  <p>${esc(d.doctorNote)}</p>

  <div class="sign">
    <div class="sign-col">
      <p class="date-line">${esc(d.generatedAt)}</p>
      <p class="role">Người lập phiếu</p>
      <p class="note">(Ký, ghi rõ họ tên)</p>
      <div class="sign-line"></div>
    </div>
    <div class="sign-col">
      <p class="date-line">&nbsp;</p>
      <p class="role">Bác sĩ chẩn đoán hình ảnh</p>
      <p class="note">(Ký, ghi rõ họ tên)</p>
      <div class="sign-line">${d.isOfficial
        ? '<strong style="color:#166534;font-style:normal;">ĐÃ KÝ XÁC NHẬN</strong>'
        : ''}</div>
    </div>
  </div>
</div>

<div class="page page-break">
  <div class="sec-title" style="font-size:14pt;">PHỤ LỤC KỸ THUẬT AI (NỘI BỘ)</div>
  <p style="font-size:10pt;">Model: CAE → Draft composer &nbsp;|&nbsp; Image ID: ${esc(sample.imageId)} &nbsp;|&nbsp; ${esc(d.generatedAt)}</p>

  <div class="sec-title" style="font-size:11pt;">1. Detection summary</div>
  <table class="data"><thead><tr><th>#</th><th>Finding</th><th>Confidence</th><th>BBox</th></tr></thead>
  <tbody>${detectionRows || '<tr><td colspan="4">Không có detection.</td></tr>'}</tbody></table>

  <div class="sec-title" style="font-size:11pt;">2. Field provenance &amp; review states</div>
  <table class="data"><thead><tr><th>#</th><th>Field</th><th>Source</th><th>Status</th><th>Prov.</th><th>Value</th></tr></thead>
  <tbody>${fieldRows || '<tr><td colspan="6">Không có field.</td></tr>'}</tbody></table>
</div>
</body></html>`;

    setPreviewHtml(html);
    setPreviewMode(true);
  };

  /** Download PDF via @react-pdf/renderer — proper Vietnamese font, no print dialog */
  const handleDownloadPdf = async (mode: 'draft' | 'official' = 'draft') => {
    const d = buildReportData(mode);
    await downloadReportPDF({
      isOfficial:     d.isOfficial,
      patientRef:     caseInfo.patientRef,
      age:            caseInfo.age,
      gender:         caseInfo.gender,
      date:           caseInfo.date,
      symptoms:       caseInfo.symptoms,
      spo2:           caseInfo.spo2,
      crp:            caseInfo.crp,
      episodeId,
      generatedAt:    d.generatedAt,
      indication:     d.indication,
      vitals:         d.vitals,
      labs:           d.labs,
      findings:       d.findings,
      impression:     d.impression,
      recommendation: d.recommendation,
      doctorNote:     d.doctorNote,
      detections: sample.annotations.map(a => ({
        label:      catShort(a.categoryId, a.category),
        confidence: `${Math.round(0.75 * 100)}%`,
      })),
    });
  };

  if (status === 'restoring') return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 border border-border rounded-sm bg-surface p-8">
      <Loader2 className="w-6 h-6 animate-spin text-text-tertiary" />
      <p className="text-xs text-text-secondary">Đang khôi phục nháp báo cáo...</p>
    </div>
  );

  if (status === 'idle') return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 border border-border rounded-sm bg-surface p-8">
      <ClipboardList className="w-8 h-8 text-text-tertiary" />
      <button onClick={handleGenerate} className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white text-xs font-semibold rounded-sm hover:opacity-90">
        <Play className="w-3.5 h-3.5" />Yêu cầu CAE sinh nháp
      </button>
    </div>
  );

  if (status === 'error') return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 border border-border rounded-sm bg-surface p-8 text-center">
      <AlertTriangle className="w-8 h-8 text-semantic-warning" />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-text-primary">CAE chưa tạo được nháp báo cáo</p>
        <p className="text-xs text-text-secondary max-w-md leading-relaxed">{error}</p>
      </div>
      <button onClick={handleGenerate} className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white text-xs font-semibold rounded-sm hover:opacity-90">
        <RefreshCw className="w-3.5 h-3.5" />Tạo lại nháp
      </button>
    </div>
  );

  if (status === 'generating') return (
    <div className="flex-1 border border-border rounded-sm bg-surface flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-text-tertiary" />
        <span className="text-xs font-semibold text-text-primary">Đang sinh nháp...</span>
      </div>
      <div className="flex-1 p-4 grid grid-cols-[minmax(0,1fr)_260px] gap-3 min-h-0">
        <div className="rounded-sm border border-border bg-background-secondary p-4 animate-pulse space-y-3 overflow-hidden">
          <div className="h-3 w-32 bg-background-tertiary rounded" />
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="rounded-sm border border-border bg-background px-3 py-3">
                <div className="h-2 w-16 bg-background-tertiary rounded" />
                <div className="h-6 w-10 bg-background-tertiary rounded mt-3" />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="rounded-sm border border-border bg-background px-3 py-3 space-y-2">
                <div className="h-2 w-24 bg-background-tertiary rounded" />
                <div className="h-3 w-full bg-background-tertiary rounded" />
                <div className="h-3 w-[88%] bg-background-tertiary rounded" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-sm border border-border bg-background-secondary p-4 space-y-3">
          <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Composer pipeline</p>
          {[
            'Đối chiếu detection với template báo cáo.',
            'Tạo patch theo từng field có provenance.',
            'Đưa field cần rà soát sang hàng đợi bác sĩ.'
          ].map((item) => (
            <div key={item} className="rounded-sm border border-border bg-background px-3 py-2 text-xs text-text-secondary leading-relaxed">
              {item}
            </div>
          ))}
          <div className="rounded-sm border border-brand-primary/30 bg-brand-light/10 px-3 py-2 text-xs text-text-secondary leading-relaxed">
            Dock vẫn có thể highlight field hoặc mở run trước đó trong lúc composer đang chạy.
          </div>
          {content && (
            <div className="rounded-sm border border-border bg-background px-3 py-2 text-[11px] text-text-tertiary leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap">
              {content}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const reviewCounts = fields.reduce(
    (counts, field) => {
      if (field.status === 'policy_blocked') counts.blocked += 1;
      else if (field.status === 'needs_review') counts.review += 1;
      else counts.ready += 1;
      return counts;
    },
    { ready: 0, review: 0, blocked: 0 }
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      {/* CAE overview (decision / comparison) — collapsible summary above fields */}
      {!previewMode && overviewBlocks.length > 0 && (
        <div className="border border-border rounded-sm bg-surface p-3 shrink-0">
          <BlockRenderer blocks={overviewBlocks} onCitationClick={handleCitationSelect} />
        </div>
      )}

      {/* Main report card */}
      <div className="border border-border rounded-sm bg-surface flex flex-col flex-1 min-h-0">
        {/* Header: inline status + mode toggle */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
          <div className="flex items-center gap-1.5 text-[10px] min-w-0">
            <span className="font-semibold text-text-primary whitespace-nowrap">Nháp báo cáo</span>
            <span className="text-text-tertiary">·</span>
            <span className="font-medium text-semantic-success whitespace-nowrap">{reviewCounts.ready} sẵn sàng</span>
            {reviewCounts.review > 0 && (
              <><span className="text-text-tertiary">·</span>
              <span className="font-medium text-semantic-warning whitespace-nowrap">{reviewCounts.review} rà soát</span></>
            )}
            {reviewCounts.blocked > 0 && (
              <><span className="text-text-tertiary">·</span>
              <span className="font-medium text-semantic-error whitespace-nowrap">{reviewCounts.blocked} blocked</span></>
            )}
          </div>
          {approved
            ? <span className="text-[10px] font-semibold text-semantic-success bg-semantic-success/10 border border-semantic-success/30 px-1.5 py-0.5 rounded-sm shrink-0">Đã duyệt</span>
            : <span className="text-[10px] text-text-tertiary border border-border/50 px-1.5 py-0.5 rounded-sm shrink-0">Nháp</span>}
          {restoredDraftId && !isStreaming && (
            <span className="flex items-center gap-1 text-[10px] text-brand-primary border border-brand-primary/30 bg-brand-light/10 px-1.5 py-0.5 rounded-sm shrink-0">
              <Database className="w-2.5 h-2.5" />Đã khôi phục
            </span>
          )}
          {/* Edit / Preview toggle + preview actions — all in one row */}
          <div className="ml-auto flex items-center gap-1 shrink-0">
            {/* Save draft button — PATCH fields to DB */}
            <button
              disabled={isSaving || approved || !restoredDraftId}
              onClick={async () => {
                if (!restoredDraftId) {
                  setSaveMsg({ type: 'err', text: 'Chưa có nháp để lưu. Hãy tạo báo cáo trước.' });
                  setTimeout(() => setSaveMsg(null), 3000);
                  return;
                }
                setIsSaving(true);
                setSaveMsg(null);
                const dbFields = fields.map(f => ({ field_id: f.key, label: f.label, value: f.value, source: f.source, status: f.status }));
                const result = await saveDraftFields({ draft_id: restoredDraftId, fields: dbFields });
                setIsSaving(false);
                if (result.ok) {
                  setSaveMsg({ type: 'ok', text: 'Đã lưu' });
                } else {
                  setSaveMsg({ type: 'err', text: result.error ?? 'Lưu thất bại' });
                }
                setTimeout(() => setSaveMsg(null), 3000);
              }}
              title={restoredDraftId ? 'Lưu nháp vào cơ sở dữ liệu' : 'Chưa có nháp để lưu'}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] border transition-colors ${
                isSaving
                  ? 'border-border text-text-tertiary cursor-wait'
                  : !restoredDraftId || approved
                  ? 'border-border text-text-tertiary cursor-not-allowed opacity-50'
                  : 'border-border text-text-secondary hover:bg-background-secondary'
              }`}
            >
              {isSaving
                ? <><Loader2 className="w-3 h-3 animate-spin" />Đang lưu…</>
                : <><Save className="w-3 h-3" />Lưu</>}
            </button>
            {saveMsg && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-medium ${
                saveMsg.type === 'ok'
                  ? 'text-semantic-success bg-semantic-success/10'
                  : 'text-semantic-error bg-semantic-error/10'
              }`}>
                {saveMsg.text}
              </span>
            )}

            {/* Download PDF button — jsPDF direct download, no print dialog */}
            <button
              onClick={() => handleDownloadPdf(approved ? 'official' : 'draft')}
              title="Tải PDF về máy ngay"
              className="flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] border border-border text-text-secondary hover:bg-background-secondary transition-colors"
            >
              <Download className="w-3 h-3" />Tải PDF
            </button>

            <div className="w-px h-3 bg-border mx-0.5" />

            {previewMode && (
              <>
                <button
                  onClick={() => handlePreview(approved ? 'official' : 'draft')}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] border border-border text-text-secondary hover:bg-background-secondary"
                >
                  <RefreshCw className="w-3 h-3" />Làm mới
                </button>
                <div className="w-px h-3 bg-border mx-0.5" />
              </>
            )}
            <div className="flex items-center gap-0.5 border border-border rounded-sm p-0.5 bg-background-secondary">
              <button
                onClick={() => setPreviewMode(false)}
                className={`px-2 py-0.5 rounded-sm text-[10px] transition-colors ${!previewMode ? 'bg-surface text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-secondary'}`}
              >
                Chỉnh sửa
              </button>
              <button
                onClick={() => handlePreview(approved ? 'official' : 'draft')}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] transition-colors ${previewMode ? 'bg-surface text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-secondary'}`}
              >
                <Eye className="w-3 h-3" />Xem PDF
              </button>
            </div>
          </div>
        </div>

        {/* Content: edit mode or PDF preview */}
        <div className={`flex-1 min-h-0 ${previewMode ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          {previewMode ? (
            <div className="flex flex-col h-full bg-background-secondary">
              {previewHtml ? (
                <iframe
                  title="Preview"
                  srcDoc={previewHtml}
                  className="flex-1 min-h-0 w-full border-0"
                  sandbox="allow-scripts allow-same-origin allow-modals"
                />
              ) : (
                <div className="flex-1 min-h-0 flex items-center justify-center p-6">
                  <button
                    onClick={() => handlePreview(approved ? 'official' : 'draft')}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white text-xs font-semibold rounded-sm hover:opacity-90"
                  >
                    <Eye className="w-3.5 h-3.5" />Tạo xem trước
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Edit mode: field-by-field review */
            <div className="p-3 space-y-3">
              {fields.map(f => {
                const isHighlighted = matchesFieldKey(f, highlightedFieldKey);
                const isReadOnly = f.source === 'locked' || approved;
                return (
                  <div key={f.key} ref={(node) => { fieldRefs.current[f.key] = node; }} className={`rounded-sm border p-3 transition-colors ${isHighlighted ? 'border-brand-primary bg-brand-light/10' : 'border-border bg-background/40'}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <label className="text-[10px] font-semibold text-text-tertiary">{f.label}</label>
                      <span className={`text-[10px] px-1 py-0.5 bg-background-tertiary border border-border rounded-sm ${f.status === 'policy_blocked' ? 'text-semantic-error' : f.status === 'needs_review' ? 'text-semantic-warning' : 'text-text-tertiary'}`}>
                        {f.status === 'policy_blocked' ? 'Bị policy chặn' : f.status === 'needs_review' ? 'Cần rà soát' : 'Sẵn sàng'}
                      </span>
                      <span className="text-[10px] px-1 py-0.5 bg-background-tertiary border border-border rounded-sm text-text-tertiary">
                        {f.source === 'locked' ? 'Khoá' : f.source === 'manual' ? 'Thủ công' : 'AI đề xuất'}
                      </span>
                      {f.modified && <span className="text-[10px] text-brand-primary font-medium ml-auto">● Đã sửa</span>}
                    </div>
                    {f.provenance.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {f.provenance.slice(0, 2).map((citation, index) => (
                          <span key={`${f.key}-citation-${index}`} className="text-[10px] px-1.5 py-0.5 rounded-sm border border-border bg-background-secondary text-text-secondary">
                            {citation.document_title}
                          </span>
                        ))}
                        {f.provenance.length > 2 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-sm border border-border bg-background-secondary text-text-tertiary">
                            +{f.provenance.length - 2} nguồn
                          </span>
                        )}
                      </div>
                    )}
                    <textarea value={f.value}
                      onChange={e => { if (!isReadOnly) setFields(fs => fs.map(x => x.key === f.key ? { ...x, value: e.target.value, modified: true, rows: getFieldRows(e.target.value) } : x)); }}
                      rows={f.rows} readOnly={isReadOnly}
                      placeholder={f.source === 'manual' ? 'Bác sỹ nhập...' : undefined}
                      className={`w-full text-xs border rounded-sm px-2.5 py-2 leading-relaxed resize-none focus:outline-none focus:border-brand-primary ${
                        isReadOnly ? 'bg-background-secondary text-text-tertiary border-border cursor-default'
                        : f.modified ? 'bg-brand-light/10 border-brand-primary/30 text-text-primary'
                        : 'bg-background border-border text-text-primary placeholder:text-text-tertiary'}`}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {!approved && (
          <div className="shrink-0 border-t border-border px-3 py-2 flex items-center gap-2">
            <p className="text-[10px] text-text-tertiary flex-1">
              {finalizeBlockReason ?? 'Đọc kỹ trước khi xác nhận bản chính thức.'}
            </p>
            {previewMode ? (
              <>
                <button
                  onClick={() => setPreviewMode(false)}
                  className="text-xs px-3 py-1.5 rounded-sm border border-border text-text-secondary hover:bg-background-secondary"
                >
                  Chỉnh sửa lại
                </button>
                <button
                  onClick={() => handlePrint('draft')}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-sm border border-brand-primary/40 text-brand-primary hover:bg-brand-light/10"
                >
                  <Printer className="w-3 h-3" />In nháp
                </button>
                <button
                  onClick={() => handlePrint('official')}
                  disabled={!canFinalize}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-sm border transition-colors ${
                    canFinalize
                      ? 'border-semantic-success/40 text-semantic-success hover:bg-semantic-success/10'
                      : 'border-border text-text-tertiary cursor-not-allowed'
                  }`}
                >
                  <Printer className="w-3 h-3" />In chính thức
                </button>
              </>
            ) : (
              <button
                onClick={() => handlePreview('draft')}
                className="text-xs px-3 py-1.5 rounded-sm border border-border text-text-secondary hover:bg-background-secondary flex items-center gap-1"
              >
                <Eye className="w-3 h-3" />Xem trước PDF
              </button>
            )}
            <button
              onClick={() => {
                if (!restoredDraftId) {
                  setSaveMsg({ type: 'err', text: 'Chưa có nháp để xác nhận.' });
                  setTimeout(() => setSaveMsg(null), 3000);
                  return;
                }
                setSignatureName('');
                setShowApproveModal(true);
              }}
              disabled={!canFinalize || isSaving}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-sm font-semibold ${
                canFinalize && !isSaving
                  ? 'bg-semantic-success text-white hover:opacity-90'
                  : 'bg-background-secondary text-text-tertiary border border-border cursor-not-allowed'
              }`}
            >
              <Check className="w-3.5 h-3.5" />BS Xác nhận & Lưu
            </button>
          </div>
        )}
        {approved && (
          <div className="shrink-0 border-t border-border px-3 py-2 flex items-center gap-2 bg-semantic-success/5">
            <Check className="w-3.5 h-3.5 text-semantic-success" />
            <p className="text-xs text-semantic-success font-medium">Báo cáo đã xác nhận · Audit trail ghi nhận</p>
          </div>
        )}
      </div>

      {/* Inline approve modal — replaces window.prompt() which is blocked in sandboxed iframe */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-md shadow-xl w-full max-w-sm mx-4 p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-1">Xác nhận bản chính thức</h3>
            <p className="text-xs text-text-secondary mb-4">
              Nhập họ tên đầy đủ của bác sĩ để ký xác nhận. Thao tác này không thể hoàn tác.
            </p>
            <label className="block text-xs text-text-secondary mb-1.5 font-medium">Họ và tên bác sĩ</label>
            <input
              type="text"
              autoFocus
              value={signatureName}
              onChange={e => setSignatureName(e.target.value)}
              onKeyDown={async e => {
                if (e.key === 'Enter' && signatureName.trim()) {
                  e.preventDefault();
                  setShowApproveModal(false);
                  setIsSaving(true);
                  setSaveMsg(null);
                  const result = await approveDraft({ draft_id: restoredDraftId!, signature_name: signatureName.trim() });
                  setIsSaving(false);
                  if (result.ok) {
                    setApproved(true);
                    invalidateDraftCache(episodeId);
                    setSaveMsg({ type: 'ok', text: 'Đã xác nhận & lưu bản chính thức' });
                  } else {
                    setSaveMsg({ type: 'err', text: result.error ?? 'Xác nhận thất bại' });
                  }
                  setTimeout(() => setSaveMsg(null), 5000);
                }
              }}
              placeholder="VD: BS. Nguyễn Văn A"
              className="w-full px-3 py-2 text-sm border border-border rounded-sm bg-background-secondary text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand-primary mb-4"
            />
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setShowApproveModal(false)}
                className="px-3 py-1.5 text-xs border border-border rounded-sm text-text-secondary hover:bg-background-secondary"
              >
                Hủy
              </button>
              <button
                disabled={!signatureName.trim() || isSaving}
                onClick={async () => {
                  setShowApproveModal(false);
                  setIsSaving(true);
                  setSaveMsg(null);
                  const result = await approveDraft({ draft_id: restoredDraftId!, signature_name: signatureName.trim() });
                  setIsSaving(false);
                  if (result.ok) {
                    setApproved(true);
                    invalidateDraftCache(episodeId);
                    setSaveMsg({ type: 'ok', text: 'Đã xác nhận & lưu bản chính thức' });
                  } else {
                    setSaveMsg({ type: 'err', text: result.error ?? 'Xác nhận thất bại' });
                  }
                  setTimeout(() => setSaveMsg(null), 5000);
                }}
                className={`px-3 py-1.5 text-xs rounded-sm font-semibold ${
                  signatureName.trim() && !isSaving
                    ? 'bg-semantic-success text-white hover:opacity-90'
                    : 'bg-background-secondary text-text-tertiary cursor-not-allowed'
                }`}
              >
                {isSaving ? <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Đang lưu…</span> : 'Xác nhận & Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step tabs ──────────────────────────────────────────────────────────────
const STEPS = [
  { key: 'detection' as Step, label: 'Phát hiện', icon: Activity },
  { key: 'explain'   as Step, label: 'Giải thích', icon: BookOpen },
  { key: 'draft'     as Step, label: 'Báo cáo',   icon: ClipboardList },
];

// ─── Main ───────────────────────────────────────────────────────────────────
function CaseDetail() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params?.id as string;
  const step = (searchParams?.get('step') ?? 'detection') as Step;
  const setStep = (s: Step) => router.push(`/cases/${id}?step=${s}`);

  const [rightMode, setRightMode] = useState<'workspace' | 'cae'>('workspace');
  const [panelMode, setPanelMode] = useState<PanelMode>('wide');
  const [manualMode, setManualMode] = useState(false);
  const [imagePanelCollapsed, setImagePanelCollapsed] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);
  const [openCitation, setOpenCitation] = useState<number | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [isLoadingEpisode, setIsLoadingEpisode] = useState(true);
  const [episodeError, setEpisodeError] = useState<string | null>(null);
  const [caseInfo, setCaseInfo] = useState<CaseInfo>(DEFAULT_CASE_INFO);
  const [liveCitations, setLiveCitations] = useState<Citation[]>([]);
  const [liveCitationAnchors, setLiveCitationAnchors] = useState<CitationAnchor[]>([]);
  const [highlightedFieldKey, setHighlightedFieldKey] = useState<string | null>(null);
  const [xrayUrl, setXrayUrl] = useState<string | null>(null);
  const focusRestoreTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch episode X-ray image URL from Storage
  useEffect(() => {
    let cancelled = false;
    getEpisodeImageUrl(id).then(({ url }) => {
      if (!cancelled) setXrayUrl(url);
    });
    return () => { cancelled = true; };
  }, [id]);

  // Fetch episode detail from API
  useEffect(() => {
    const fetchEpisode = async () => {
      setIsLoadingEpisode(true);
      setEpisodeError(null);

      try {
        const response = await getEpisodeDetail(id);
        if (response.success && response.episode) {
          const ep = response.episode;
          setCaseInfo({
            patientRef: ep.patient_ref ?? '—',
            age: ep.age ?? '—',
            gender: ep.gender ?? '—',
            date: (ep.date ?? ep.admission_date ?? '—').slice(0, 10),
            symptoms: ep.symptoms ?? '—',
            spo2: ep.spo2 ?? '—',
            crp: ep.crp ?? '—',
          });
        } else {
          setEpisodeError(response.error?.message || 'Không thể tải thông tin ca');
        }
      } catch (err) {
        setEpisodeError('Lỗi kết nối');
        console.error('Failed to fetch episode:', err);
      } finally {
        setIsLoadingEpisode(false);
      }
    };

    fetchEpisode();
  }, [id]);

  // Build a real sample from the fetched image URL (no mock annotations)
  const sample: PcxrSample = { idx: 0, key: id, imageId: id, imgSrc: xrayUrl ?? '', dim: 1280, annotations: [] };
  const findingIds: string[] = [];

  // Auto-switch panel width on step change unless user overrode
  useEffect(() => {
    if (!manualMode) setPanelMode(STEP_DEFAULT_MODE[step]);
  }, [step, manualMode]);

  // Auto-collapse image panel when entering draft; restore when leaving
  useEffect(() => {
    setImagePanelCollapsed(step === 'draft');
  }, [step]);

  useEffect(() => {
    return () => {
      if (focusRestoreTimeoutRef.current) {
        clearTimeout(focusRestoreTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (step !== 'draft') {
      setHighlightedFieldKey(null);
    }
  }, [step]);

  const setFocusedFinding = (nextIndex: number | null, ttlMs?: number) => {
    if (focusRestoreTimeoutRef.current) {
      clearTimeout(focusRestoreTimeoutRef.current);
      focusRestoreTimeoutRef.current = null;
    }

    setFocusedIdx(nextIndex);

    if (nextIndex !== null && ttlMs && ttlMs > 0) {
      focusRestoreTimeoutRef.current = setTimeout(() => {
        setFocusedIdx(null);
        focusRestoreTimeoutRef.current = null;
      }, ttlMs);
    }
  };

  const handleSetStep = (s: Step) => { setManualMode(false); setStep(s); };
  const handleSetMode = (m: PanelMode) => { setManualMode(true); setPanelMode(m); };

  const handleCAECitationClick = (citationId: string) => {
    const citationNum = Number.parseInt(citationId, 10);
    if (Number.isFinite(citationNum)) {
      setOpenCitation(citationNum);
    }
    if (step !== 'explain') {
      handleSetStep('explain');
    }
  };

  const handleCAEAction = (action: UIAction) => {
    if (action.type === 'dock_state' && action.state === 'compose' && step !== 'draft') {
      handleSetStep('draft');
      setRightMode('workspace');
      return;
    }

    if (action.type === 'highlight_field') {
      setHighlightedFieldKey(action.fieldId);
      if (step !== 'draft') {
        handleSetStep('draft');
      }
      setRightMode('workspace');
      return;
    }

    if (action.type === 'focus_finding') {
      const resolvedFindingIndex = resolveFindingIndex(sample.annotations, action.findingId);
      if (resolvedFindingIndex !== null) {
        setFocusedFinding(resolvedFindingIndex, action.ttlMs ?? 5000);
      }
      return;
    }

    if (action.type === 'restore_view') {
      setFocusedFinding(null);
      return;
    }

    if (action.type === 'open_evidence') {
      handleCAECitationClick(action.citationId);
    }
  };

  if (isLoadingEpisode) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <LoadingSpinner label="Đang tải thông tin ca bệnh" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Slim top bar: patient meta + layout presets. Back link is in SlimBar. */}
      <div className="flex items-center gap-3 shrink-0 h-8">
        <span className="text-xs text-text-tertiary">
          {caseInfo.age !== '—' && <>{caseInfo.age} · {caseInfo.gender} · {caseInfo.date}</>}
        </span>
        <div className="flex items-center gap-1.5 ml-auto">
          {!imagePanelCollapsed && (
            <div className="flex items-center gap-0.5 border border-border rounded-sm p-0.5 bg-background-secondary">
              {([
                { mode: 'wide'      as PanelMode, g: '▐▐▌', tip: 'Ảnh rộng (54%)' },
                { mode: 'balanced'  as PanelMode, g: '▐▌▌', tip: 'Cân bằng (44%)' },
                { mode: 'compact'   as PanelMode, g: '▌▌▐', tip: 'Text rộng (30%)' },
              ]).map(m => (
                <button key={m.mode} onClick={() => handleSetMode(m.mode)} title={m.tip}
                  className={`px-2 py-0.5 rounded-sm text-[10px] font-mono tracking-widest transition-colors ${panelMode === m.mode ? 'bg-surface text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-secondary'}`}>
                  {m.g}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {episodeError && (
        <div className="flex items-start gap-2 rounded-sm border border-semantic-warning/30 bg-semantic-warning/5 px-3 py-2 shrink-0">
          <AlertTriangle className="w-4 h-4 text-semantic-warning shrink-0 mt-0.5" />
          <p className="text-xs text-text-secondary leading-relaxed">{episodeError}</p>
        </div>
      )}

      {/* Main workspace: X-ray | Tabbed right panel */}
      <div className="flex gap-2 flex-1 min-h-0">
        {imagePanelCollapsed ? (
          <div className="shrink-0 w-10 flex flex-col border border-border rounded-sm bg-surface overflow-hidden">
            <button
              onClick={() => setImagePanelCollapsed(false)}
              title="Hiện ảnh X-quang"
              className="flex-1 flex flex-col items-center justify-center gap-2 text-text-tertiary hover:text-text-primary hover:bg-background-secondary transition-colors py-3"
            >
              <Maximize2 className="w-3.5 h-3.5 shrink-0" />
              <span className="[writing-mode:vertical-rl] [text-orientation:mixed] text-[9px] font-medium uppercase tracking-wider select-none">X-quang</span>
            </button>
          </div>
        ) : (
          <ImagePanel
            widthPct={PANEL_WIDTHS[panelMode]}
            sample={sample}
            caseInfo={caseInfo}
            episodeId={id}
            hoveredIdx={hoveredIdx}
            onHoverIdx={setHoveredIdx}
            focusedIdx={focusedIdx}
            onFocusIdx={setFocusedFinding}
            onFullscreen={() => setFullscreen(true)}
            onCollapse={step === 'draft' ? () => setImagePanelCollapsed(true) : undefined}
          />
        )}

        {/* Right: single flex-1 tabbed container */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0 border border-border rounded-sm overflow-hidden bg-surface">

          {/* Tab bar */}
          <div className="flex items-center gap-0.5 px-2 border-b border-border bg-background-secondary shrink-0 h-9">
            {STEPS.map((s, i) => {
              const isActive = step === s.key && rightMode === 'workspace';
              const isDone = rightMode === 'workspace' && STEPS.findIndex(x => x.key === step) > i;
              const Icon = s.icon;
              return (
                <button
                  key={s.key}
                  onClick={() => { setRightMode('workspace'); handleSetStep(s.key); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-surface text-text-primary shadow-sm'
                      : 'text-text-tertiary hover:text-text-secondary hover:bg-background-tertiary'
                  }`}
                >
                  {isDone
                    ? <Check className="w-3 h-3 text-semantic-success" />
                    : <Icon className={`w-3 h-3 ${isActive ? 'text-brand-primary' : 'text-text-tertiary'}`} />
                  }
                  {s.label}
                </button>
              );
            })}

            <div className="flex-1" />

            {/* CAE tab */}
            <button
              onClick={() => setRightMode(rightMode === 'cae' ? 'workspace' : 'cae')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-semibold transition-colors ${
                rightMode === 'cae'
                  ? 'bg-brand-light text-brand-primary border border-brand-primary/20'
                  : 'text-text-tertiary hover:text-text-secondary hover:bg-background-tertiary'
              }`}
            >
              <Brain className="w-3 h-3" />
              CAE
              {liveCitationAnchors.length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-breathe" />
              )}
            </button>


          </div>

          {/* Workspace content — hidden (but mounted) when CAE tab active */}
          <div className={`flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto p-3 ${rightMode === 'cae' ? 'hidden' : ''}`}>
            {/* Panels are always mounted — CSS hidden to preserve state across tab switches */}
            <div className={step !== 'detection' ? 'hidden' : 'flex flex-col flex-1 min-h-0'}>
              <DetectionPanel sample={sample} hoveredIdx={hoveredIdx} onHoverIdx={setHoveredIdx} focusedIdx={focusedIdx} onFocusIdx={setFocusedFinding} onNext={() => handleSetStep('explain')} />
            </div>
            <div className={step !== 'explain' ? 'hidden' : 'flex flex-col flex-1 min-h-0'}>
              <ExplainPanel episodeId={id} sample={sample} onNext={() => handleSetStep('draft')} onCitation={setOpenCitation} onCitationsLoaded={setLiveCitations} onStructuredCitationsLoaded={setLiveCitationAnchors} focusedIdx={focusedIdx} onFocusIdx={setFocusedFinding} />
            </div>
            <div className={step !== 'draft' ? 'hidden' : 'flex flex-col flex-1 min-h-0'}>
              <DraftPanel episodeId={id} sample={sample} caseInfo={caseInfo} highlightedFieldKey={highlightedFieldKey} onCitation={setOpenCitation} onCitationsLoaded={setLiveCitations} onStructuredCitationsLoaded={setLiveCitationAnchors} />
            </div>
          </div>

          {/* CAE panel — always mounted for state/stream preservation, shown when CAE tab active */}
          <div className={`flex-1 min-h-0 overflow-hidden ${rightMode !== 'cae' ? 'hidden' : 'flex'}`}>
            <CAEDock
              fullWidth
              episodeId={id}
              currentStep={step}
              findingIds={findingIds}
              contextCitations={liveCitationAnchors}
              onCitationClick={handleCAECitationClick}
              onCitationsChange={(citations) => {
                setLiveCitationAnchors(citations);
                setLiveCitations(citations.map((citation, index) => mapStructuredCitation(citation, index)));
              }}
              onUIAction={handleCAEAction}
              onActivityDetected={() => {}}
            />
          </div>



        </div>
      </div>

      {fullscreen && <FullscreenViewer sample={sample} caseInfo={caseInfo} hoveredIdx={hoveredIdx} onHoverIdx={setHoveredIdx} onClose={() => setFullscreen(false)} />}
      {openCitation !== null && <CitationPopup num={openCitation} citations={liveCitations} onClose={() => setOpenCitation(null)} />}
    </div>
  );
}

export default function CaseDetailPage() {
  return (
    <PageTransition>
      <Suspense fallback={<div className="p-8 text-xs text-text-tertiary">Đang tải...</div>}>
        <CaseDetail />
      </Suspense>
    </PageTransition>
  );
}
