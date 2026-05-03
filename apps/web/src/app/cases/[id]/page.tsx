'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Activity, BookOpen, ClipboardList,
  ChevronRight, AlertTriangle, Play, Check, X,
  User, Calendar, Stethoscope, Send,
  ThumbsUp, ThumbsDown, Loader2, RefreshCw, FlaskConical,
  Maximize2,
} from 'lucide-react';
import { PageTransition } from '@/components/ui/page-transition';
import { DetectionSkeleton, ExplanationSkeleton, DraftSkeleton } from '@/components/ui/loading-skeleton';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { getEpisodeDetail, explainDetection, queryKnowledge, generateDraft } from '@/lib/api/client';
import { motion } from 'framer-motion';
import { CAEDock } from '@/components/cae/CAEDock';

// ─── Types ─────────────────────────────────────────────────────────────────
type Step = 'detection' | 'explain' | 'draft';
type PanelMode = 'wide' | 'balanced' | 'compact';
interface ChatMsg { role: 'user' | 'assistant'; content: string; }
interface DraftField {
  key: string; label: string; value: string;
  modified: boolean; type: 'ai' | 'required' | 'readonly'; rows: number;
}
interface PendingChange { fieldKey: string; newValue: string; label: string; }
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

// ─── Real PCXR sample data ─────────────────────────────────────────────────
const PCXR_SAMPLES: PcxrSample[] = [
  { idx: 0, key: '01', imageId: 'imgid_336', imgSrc: '/pcxr/01_imgid_336_3629dcfcfeecccbae6c41839616c5089.png', dim: 1280,
    annotations: [{ id: 231, categoryId: 30, category: 'Peribronchovascular interstitial opacity', bbox: [726.75, 482.475, 160.589, 178.698] }] },
  { idx: 1, key: '02', imageId: 'imgid_70',  imgSrc: '/pcxr/02_imgid_70_0a4a406f3616736f9564f7a0f0c7c807.png', dim: 1280,
    annotations: [{ id: 56,  categoryId: 18, category: 'Expanded edges of the anterior ribs',        bbox: [304.643, 390.031, 114.334, 110.068] }] },
  { idx: 2, key: '03', imageId: 'imgid_856', imgSrc: '/pcxr/03_imgid_856_8c9dc1aaf0c0782f2152ee54a23eed5d.png', dim: 1280,
    annotations: [
      { id: 543, categoryId: 35, category: 'Reticulonodular opacity', bbox: [259.542, 254.787, 283.894, 547.489] },
      { id: 544, categoryId: 35, category: 'Reticulonodular opacity', bbox: [767.847, 275.064, 246.042, 515.045] },
    ] },
  { idx: 3, key: '04', imageId: 'imgid_750', imgSrc: '/pcxr/04_imgid_750_7ef3f0f3b3455abf5cb0d6d7e64c5275.png', dim: 1280,
    annotations: [{ id: 485, categoryId: 30, category: 'Peribronchovascular interstitial opacity', bbox: [803.467, 353.957, 152.286, 357.054] }] },
  { idx: 4, key: '05', imageId: 'imgid_660', imgSrc: '/pcxr/05_imgid_660_6ed015598fa61f9a4c28a94cfe39ac75.png', dim: 1280,
    annotations: [
      { id: 446, categoryId: 30, category: 'Peribronchovascular interstitial opacity', bbox: [506.822, 436.627, 95.336, 321.313] },
      { id: 447, categoryId: 30, category: 'Peribronchovascular interstitial opacity', bbox: [799.359, 534.588, 116.231, 239.025] },
    ] },
  { idx: 5, key: '06', imageId: 'imgid_416', imgSrc: '/pcxr/06_imgid_416_42bcf79a642d33560942207cbbcccf45.png', dim: 1280,
    annotations: [{ id: 283, categoryId: 8,  category: 'Cardiomegaly',                              bbox: [444.058, 427.409, 556.654, 367.304] }] },
  { idx: 6, key: '07', imageId: 'imgid_317', imgSrc: '/pcxr/07_imgid_317_32d2df88024edd4fac0ee963add34732.png', dim: 1280,
    annotations: [
      { id: 213, categoryId: 35, category: 'Reticulonodular opacity', bbox: [438.248, 579.498, 71.352,  75.331] },
      { id: 214, categoryId: 35, category: 'Reticulonodular opacity', bbox: [458.068, 427.845, 70.361, 100.111] },
    ] },
  { idx: 7, key: '08', imageId: 'imgid_284', imgSrc: '/pcxr/08_imgid_284_2dd5899b11661cf3b50c0676eae17b64.png', dim: 1280,
    annotations: [{ id: 185, categoryId: 6,  category: 'Bronchial thickening',                      bbox: [457.859, 532.002, 76.417, 65.221] }] },
  { idx: 8, key: '09', imageId: 'imgid_1300',imgSrc: '/pcxr/09_imgid_1300_d6abc594cf9b5df05fb2c16195bc9f46.png', dim: 1280,
    annotations: [
      { id: 846, categoryId: 8,  category: 'Cardiomegaly',                              bbox: [404.549, 418.981, 535.831, 345.559] },
      { id: 847, categoryId: 30, category: 'Peribronchovascular interstitial opacity', bbox: [281.871, 313.198, 208.692, 394.925] },
      { id: 848, categoryId: 30, category: 'Peribronchovascular interstitial opacity', bbox: [728.868, 318.84,  256.635, 389.283] },
    ] },
  { idx: 9, key: '10', imageId: 'imgid_96',  imgSrc: '/pcxr/10_imgid_96_0e4a528a45ba9be08e9cf230b6afd3ff.png', dim: 1280,
    annotations: [
      { id: 67, categoryId: 30, category: 'Peribronchovascular interstitial opacity', bbox: [431.018, 427.389, 109.761, 160.129] },
      { id: 68, categoryId: 35, category: 'Reticulonodular opacity',                  bbox: [375.084, 461.403, 42.069,  130.23]  },
    ] },
];

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
function mockScore(annId: number): number { return Math.min(0.95, 0.65 + (annId % 29) / 90); }

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

// ─── Episode to Sample mapping ─────────────────────────────────────────────
// Maps episode_id → PCXR sample index (0-9)
// In production, this will be fetched from Supabase based on episode_id
const EPISODE_TO_SAMPLE: Record<string, number> = {
  'EP-2024-010': 0, // imgid_336 — Peribronchovascular interstitial opacity
  'EP-2024-009': 1, // imgid_70  — Expanded edges of the anterior ribs
  'EP-2024-008': 2, // imgid_856 — Reticulonodular opacity (bilateral)
  'EP-2024-007': 3, // imgid_750 — Peribronchovascular interstitial opacity
  'EP-2024-006': 4, // imgid_660 — Peribronchovascular interstitial opacity (2)
  'EP-2024-005': 5, // imgid_416 — Cardiomegaly
  'EP-2024-004': 6, // imgid_317 — Reticulonodular opacity (2)
  'EP-2024-003': 7, // imgid_284 — Bronchial thickening
  'EP-2024-002': 8, // imgid_1300 — Cardiomegaly + Peribronchovascular (3 findings)
  'EP-2024-001': 9, // imgid_96  — Peribronchovascular + Reticulonodular
};

// ─── Citations & draft data ────────────────────────────────────────────────
const CITATIONS_DATA = [
  { num: 1, ref: 'WHO — Pocket Book of Hospital Care for Children, 2023', section: '§3.2 — Diagnosis of pneumonia',
    passage: 'In a child with cough or difficulty breathing, classify as pneumonia if there is fast breathing (≥50 breaths/min in 2–12 months, ≥40 in 1–5 years) or chest indrawing.', confidence: 0.91 },
  { num: 2, ref: 'BYT Việt Nam — Hướng dẫn chẩn đoán viêm phổi trẻ em, 2020', section: '§5.1 — Phân loại mức độ nặng',
    passage: 'Viêm phổi nặng: SpO₂ < 95%, nhịp thở nhanh, co rút lõm ngực, hoặc không uống được. Trẻ có dấu hiệu này cần nhập viện và điều trị kháng sinh theo phác đồ.', confidence: 0.87 },
  { num: 3, ref: 'BTS — Paediatric Pneumonia Guidelines, 2022', section: 'p.18 — Parapneumonic effusion',
    passage: 'Parapneumonic effusions occur in ~20–40% of children hospitalised with bacterial pneumonia. Small-moderate effusions usually resolve with antibiotics.', confidence: 0.83 },
];

const EXPLANATION_TEXT = `Hình ảnh X-quang ngực cho thấy đông đặc vùng thùy dưới phổi phải, bờ không rõ — phù hợp với tổn thương viêm phổi thùy. Kèm theo hình ảnh mờ góc sườn hoành phải, gợi ý tràn dịch màng phổi mức độ nhẹ đến vừa. [1]

Kết hợp lâm sàng: trẻ 3 tuổi, sốt 3 ngày, thở nhanh, SpO₂ 94%, CRP 45.2 mg/L — phù hợp viêm phổi vi khuẩn. SpO₂ < 95% là tiêu chuẩn mức nặng theo WHO 2023, cần nhập viện và điều trị theo phác đồ. [2]

Tràn dịch màng phổi kèm theo gặp ở 20–40% viêm phổi vi khuẩn. Cần theo dõi diễn tiến và đánh giá chỉ định can thiệp nếu lượng tăng hoặc không cải thiện sau 48 giờ kháng sinh. [3]`;

const INITIAL_DRAFT: DraftField[] = [
  { key: 'xray', label: 'Nhận xét X-quang', type: 'ai', rows: 3, modified: false, value: 'Đông đặc thùy dưới phổi phải, bờ không rõ. Tràn dịch màng phổi phải mức độ nhẹ-vừa.' },
  { key: 'suggestion', label: 'Gợi ý chẩn đoán hỗ trợ', type: 'ai', rows: 3, modified: false, value: 'Hình ảnh phù hợp viêm phổi thùy do vi khuẩn ở trẻ 3 tuổi. Cần kết hợp lâm sàng để kết luận. Không thay thế chẩn đoán của bác sỹ điều trị.' },
  { key: 'severity', label: 'Mức độ nặng ước tính', type: 'readonly', rows: 1, modified: false, value: 'Nặng (WHO 2023) — SpO₂ 94% < 95%, thở nhanh' },
  { key: 'recommendation', label: 'Khuyến nghị theo dõi', type: 'ai', rows: 2, modified: false, value: 'Theo dõi SpO₂ và nhịp thở. Đánh giá lại sau 24 giờ điều trị.' },
  { key: 'note', label: 'Ghi chú đọc phim', type: 'required', rows: 3, modified: false, value: '' },
];

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
function getKnowledgeReply(q: string): string {
  const l = q.toLowerCase();
  if (l.match(/nhập viện|nặng/)) return 'Theo WHO 2023, tiêu chuẩn nhập viện: SpO₂ < 95%, nhịp thở nhanh, rút lõm lồng ngực, hoặc không uống được.\nCa này SpO₂ 94% → đáp ứng tiêu chuẩn.\n\n📚 WHO Pocket Book 2023, §4.1';
  if (l.match(/điều trị|kháng sinh/)) return 'Hệ thống không đưa ra khuyến nghị điều trị hoặc kê đơn.\n\n⚠ Tham khảo phác đồ khoa và quyết định của bác sỹ điều trị.';
  if (l.match(/tràn dịch|effusion/)) return 'Tràn dịch trong viêm phổi vi khuẩn gặp ở 20–40%. Theo BTS 2022, tràn dịch nhẹ-vừa thường tự hấp thu. Can thiệp khi lượng nhiều, không cải thiện sau 48h, hoặc nghi empyema.\n\n📚 BTS 2022, p.18';
  return 'Chưa tìm thấy đoạn tài liệu đủ tin cậy cho câu hỏi này.\n\n⚠ Knowledge Agent chưa implement — mock response.';
}
function getDraftAdjustment(cmd: string, fields: DraftField[]): PendingChange | null {
  const l = cmd.toLowerCase();
  if (l.match(/spo2|4 giờ|theo dõi/)) {
    const f = fields.find(x => x.key === 'recommendation');
    if (f) return { fieldKey: 'recommendation', label: f.label, newValue: f.value.trimEnd() + ' Theo dõi SpO₂ mỗi 4 giờ và nhịp thở mỗi 2 giờ trong 24 giờ đầu.' };
  }
  if (l.match(/ngắn|viết lại/)) return { fieldKey: 'suggestion', label: 'Gợi ý chẩn đoán hỗ trợ', newValue: 'Hình ảnh phù hợp viêm phổi vi khuẩn thùy phổi phải. Cần BS xác nhận.' };
  if (l.match(/phổi trái/)) {
    const f = fields.find(x => x.key === 'xray');
    if (f) return { fieldKey: 'xray', label: f.label, newValue: f.value.trimEnd() + ' Phổi trái không có tổn thương rõ.' };
  }
  return null;
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
              className="inline-flex items-center justify-center w-[17px] h-[14px] text-[9px] font-bold text-brand-primary bg-brand-light border border-brand-primary/40 rounded-sm mx-0.5 hover:bg-brand-primary hover:text-white transition-colors align-middle">
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
  const dim = sample.dim;

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
          {/* Real X-ray image */}
          <img
            src={sample.imgSrc}
            alt={sample.imageId}
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: 'cover' }}
            draggable={false}
          />

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
                }}
                className={`border-2 cursor-pointer transition-all duration-150 ${col.border} ${isHot || isFocused ? col.bgHover : 'bg-transparent'}`}
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
                  {catShort(ann.categoryId, ann.category)} · {(mockScore(ann.id) * 100).toFixed(0)}%
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
function ImagePanel({
  widthPct, sample, caseInfo,
  hoveredIdx, onHoverIdx, focusedIdx, onFocusIdx, onFullscreen,
}: {
  widthPct: number; sample: PcxrSample; caseInfo: CaseInfo;
  hoveredIdx: number | null; onHoverIdx: (i: number | null) => void;
  focusedIdx: number | null; onFocusIdx: (i: number | null) => void;
  onFullscreen: () => void;
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
          </div>
        </div>

        {/* Viewport — flex-1 fills remaining card height; ResizeObserver draws max square inside */}
        <div className="flex-1 min-h-0">
          <XrayViewport sample={sample} hoveredIdx={hoveredIdx} onHoverIdx={onHoverIdx} focusedIdx={focusedIdx} onFocusIdx={onFocusIdx} />
        </div>

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
              <span className="text-[10px] font-mono text-zinc-500">{(mockScore(ann.id) * 100).toFixed(0)}%</span>
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
            const score = mockScore(ann.id);
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
  episodeId, sample, onNext, onCitation, onCitationsLoaded,
}: {
  episodeId: string;
  sample: PcxrSample;
  onNext: () => void;
  onCitation: (n: number) => void;
  onCitationsLoaded: (cits: Citation[]) => void;
}) {
  const [status, setStatus] = useState<'idle' | 'streaming' | 'done'>('idle');
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState<'accepted' | 'rejected' | null>(null);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [liveCitations, setLiveCitations] = useState<Citation[]>([]);
  const [llmProvider, setLlmProvider] = useState<'ollama' | 'mimo'>('mimo');
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const handleRun = async () => {
    setStatus('streaming'); setText('');
    try {
      const res = await explainDetection(episodeId, {
        image_id: sample.imageId,
        detections: sample.annotations.map(a => ({ bbox: a.bbox, label: a.category, score: mockScore(a.id) })),
      });
      if (res.success) {
        const mapped: Citation[] = (res.citations ?? []).map((c: any, i: number) => ({
          num: i + 1,
          ref: `${c.document_title ?? ''} ${c.version ?? ''}`.trim(),
          section: c.effective_date ?? '',
          passage: c.excerpt ?? '',
          confidence: 0.8,
        }));
        setLiveCitations(mapped);
        onCitationsLoaded(mapped);
        streamText(res.explanation ?? EXPLANATION_TEXT, setText, () => setStatus('done'));
      } else {
        streamText(EXPLANATION_TEXT, setText, () => setStatus('done'));
      }
    } catch {
      streamText(EXPLANATION_TEXT, setText, () => setStatus('done'));
    }
  };

  const handleSend = async () => {
    const q = input.trim(); if (!q) return;
    setInput(''); setMsgs(m => [...m, { role: 'user', content: q }]); setLoading(true);
    try {
      const res = await queryKnowledge(q, episodeId, llmProvider);
      const answer = res.success && res.answer ? res.answer : getKnowledgeReply(q);
      setMsgs(m => [...m, { role: 'assistant', content: answer }]);
    } catch {
      setMsgs(m => [...m, { role: 'assistant', content: getKnowledgeReply(q) }]);
    } finally {
      setLoading(false);
    }
  };

  const displayCitations = liveCitations.length > 0 ? liveCitations : CITATIONS_DATA;

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      <div className="border border-border rounded-sm bg-surface flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
          <span className="text-xs font-semibold text-text-primary">CAE giải thích lâm sàng</span>
          <div className="flex items-center gap-2">
            {/* Provider toggle */}
            <div className="flex items-center border border-border rounded-sm overflow-hidden">
              <button onClick={() => setLlmProvider('ollama')}
                className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${llmProvider === 'ollama' ? 'bg-brand-primary text-white' : 'bg-surface text-text-tertiary hover:bg-background-secondary'}`}>
                Ollama
              </button>
              <button onClick={() => setLlmProvider('mimo')}
                className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${llmProvider === 'mimo' ? 'bg-brand-primary text-white' : 'bg-surface text-text-tertiary hover:bg-background-secondary'}`}>
                MiMo
              </button>
            </div>
            {status === 'streaming' && <div className="flex items-center gap-1.5 text-[10px] text-text-tertiary"><Loader2 className="w-3 h-3 animate-spin" />Đang tạo...</div>}
            {status === 'done' && <span className="text-[10px] text-text-tertiary font-mono">{llmProvider === 'mimo' ? 'mimo-v2.5-pro' : 'qwen2.5:7b'} · nhấn <span className="text-brand-primary font-bold">[N]</span> xem nguồn</span>}
          </div>
        </div>
        {status === 'idle' ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3">
            <Play className="w-8 h-8 text-text-tertiary" />
            <button onClick={handleRun} className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white text-xs font-semibold rounded-sm hover:opacity-90">
              <Play className="w-3.5 h-3.5" />Chạy CAE giải thích
            </button>
          </div>
        ) : status === 'streaming' ? (
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            <p className="text-sm text-text-primary leading-relaxed">
              {text}<span className="inline-block w-0.5 h-4 bg-brand-primary ml-0.5 animate-pulse" />
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            <p className="text-sm text-text-primary leading-relaxed">
              <TextWithCitations text={text} onCitationClick={onCitation} />
            </p>
            {status === 'done' && (
              <div className="mt-4 pt-3 border-t border-border">
                <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-2">Nguồn — nhấn để đọc</p>
                <div className="space-y-1.5">
                  {displayCitations.map(c => (
                    <button key={c.num} onClick={() => onCitation(c.num)}
                      className="w-full flex items-start gap-2 p-2 rounded-sm bg-background-secondary border border-border hover:border-brand-primary/50 hover:bg-brand-light/10 transition-colors text-left">
                      <span className="text-[10px] font-bold text-brand-primary w-5 shrink-0">[{c.num}]</span>
                      <div><p className="text-[11px] font-medium text-text-primary truncate">{c.ref}</p><p className="text-[10px] text-text-tertiary">{c.section}</p></div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {status === 'done' && (
          <div className="shrink-0 border-t border-border px-3 py-2 flex items-center gap-2">
            <span className="text-[10px] text-text-tertiary mr-1">Phản hồi:</span>
            {(['accepted', 'rejected'] as const).map(fb => (
              <button key={fb} onClick={() => setFeedback(fb)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[11px] font-medium border transition-colors ${
                  feedback === fb
                    ? fb === 'accepted' ? 'bg-semantic-success/10 text-semantic-success border-semantic-success/30' : 'bg-semantic-error/10 text-semantic-error border-semantic-error/30'
                    : 'border-border text-text-secondary hover:bg-background-secondary'
                }`}>
                {fb === 'accepted' ? <ThumbsUp className="w-3 h-3" /> : <ThumbsDown className="w-3 h-3" />}
                {fb === 'accepted' ? (feedback === 'accepted' ? 'Đã chấp nhận' : 'Chấp nhận') : (feedback === 'rejected' ? 'Không phù hợp' : 'Không phù hợp')}
              </button>
            ))}
            {feedback && <button onClick={() => { setFeedback(null); handleRun(); }} className="flex items-center gap-1 text-[10px] text-text-tertiary ml-auto hover:text-text-primary"><RefreshCw className="w-3 h-3" />Chạy lại</button>}
          </div>
        )}
      </div>

      {status === 'done' && (
        <div className="border border-border rounded-sm bg-surface flex flex-col shrink-0" style={{ maxHeight: 220 }}>
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border shrink-0">
            <BookOpen className="w-3.5 h-3.5 text-text-tertiary" />
            <span className="text-xs font-semibold text-text-primary">Hỏi thêm CAE</span>
            <span className="text-[10px] text-text-tertiary ml-1">RAG theo ca</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2 min-h-0">
            {msgs.length === 0 && (
              <div className="flex flex-wrap gap-1.5">
                {['Tiêu chuẩn nhập viện?', 'Tràn dịch cần can thiệp khi nào?'].map(s => (
                  <button key={s} onClick={() => setInput(s)} className="text-[10px] px-2 py-1 border border-border rounded-sm text-text-secondary hover:bg-background-secondary hover:border-brand-primary transition-colors">{s}</button>
                ))}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-2.5 py-2 rounded-sm text-xs leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'bg-brand-primary text-white' : 'bg-background-secondary border border-border text-text-primary'}`}>{m.content}</div>
              </div>
            ))}
            {loading && <div className="flex justify-start"><div className="px-2.5 py-2 rounded-sm bg-background-secondary border border-border flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin text-text-tertiary" /><span className="text-[11px] text-text-tertiary">Đang tra cứu...</span></div></div>}
            <div ref={endRef} />
          </div>
          <div className="shrink-0 border-t border-border p-2 flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Hỏi thêm..." className="flex-1 text-xs border border-border rounded-sm px-2.5 py-1.5 bg-background focus:outline-none focus:border-brand-primary text-text-primary placeholder:text-text-tertiary" />
            <button onClick={handleSend} disabled={!input.trim() || loading} className="w-8 h-8 flex items-center justify-center rounded-sm bg-brand-primary text-white disabled:opacity-40"><Send className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      )}

      {status === 'done' && (
        <button onClick={onNext} className="flex items-center justify-center gap-2 w-full py-2 border border-border text-text-secondary text-xs font-semibold rounded-sm hover:bg-background-secondary shrink-0">
          Tiếp tục — Sinh nháp báo cáo <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── Step 3: Draft ─────────────────────────────────────────────────────────
function DraftPanel({ episodeId, sample }: { episodeId: string; sample: PcxrSample }) {
  const [status, setStatus] = useState<'idle' | 'generating' | 'done'>('idle');
  const [genText, setGenText] = useState('');
  const [fields, setFields] = useState<DraftField[]>(INITIAL_DRAFT);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [approved, setApproved] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const handleGenerate = async () => {
    setStatus('generating');
    try {
      const res = await generateDraft(episodeId, 'default', {
        image_id: sample.imageId,
        detections: sample.annotations.map(a => ({ bbox: a.bbox, label: a.category, score: mockScore(a.id) })),
      });
      if (res.success && res.fields) {
        const mappedFields: DraftField[] = (res.fields ?? []).map((f: any) => ({
          key: f.field_id,
          label: f.label,
          value: f.value ?? '',
          modified: false,
          type: f.source === 'locked' ? 'readonly' : f.source === 'ai' ? 'ai' : 'required',
          rows: f.value && f.value.length > 80 ? 3 : 2,
        }));
        if (mappedFields.length > 0) {
          const preview = mappedFields.filter(f => f.type === 'ai').map(f => `${f.label}:\n${f.value}`).join('\n\n');
          streamText(preview, setGenText, () => { setStatus('done'); setGenText(''); setFields(mappedFields); });
          return;
        }
      }
    } catch { /* fall through to mock */ }
    // Fallback to mock
    const preview = INITIAL_DRAFT.filter(f => f.type === 'ai').map(f => `${f.label}:\n${f.value}`).join('\n\n');
    streamText(preview, setGenText, () => { setStatus('done'); setGenText(''); });
  };
  const handleSend = () => {
    const cmd = input.trim(); if (!cmd) return;
    setInput(''); setMsgs(m => [...m, { role: 'user', content: cmd }]); setLoading(true);
    setTimeout(() => {
      const adj = getDraftAdjustment(cmd, fields);
      if (adj) { setPending(adj); setMsgs(m => [...m, { role: 'assistant', content: `Đề xuất chỉnh trường "${adj.label}" sẵn sàng.` }]); }
      else setMsgs(m => [...m, { role: 'assistant', content: 'Không xác định trường cần sửa. Thử: "Thêm vào Khuyến nghị...", "Viết lại Gợi ý CĐ ngắn hơn".' }]);
      setLoading(false);
    }, 1200);
  };
  const acceptChange = () => {
    if (!pending) return;
    setFields(fs => fs.map(f => f.key === pending.fieldKey ? { ...f, value: pending.newValue, modified: true } : f));
    setPending(null);
  };

  if (status === 'idle') return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 border border-border rounded-sm bg-surface p-8">
      <ClipboardList className="w-8 h-8 text-text-tertiary" />
      <button onClick={handleGenerate} className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white text-xs font-semibold rounded-sm hover:opacity-90">
        <Play className="w-3.5 h-3.5" />Yêu cầu CAE sinh nháp
      </button>
    </div>
  );

  if (status === 'generating') return (
    <div className="flex-1 border border-border rounded-sm bg-surface flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-text-tertiary" />
        <span className="text-xs font-semibold text-text-primary">Đang sinh nháp...</span>
      </div>
      <div className="flex-1 p-4 font-mono text-[11px] text-text-secondary leading-relaxed whitespace-pre-wrap overflow-auto">
        {genText}<span className="inline-block w-0.5 h-3.5 bg-brand-primary ml-0.5 animate-pulse" />
      </div>
    </div>
  );

  return (
    <div className="flex gap-3 flex-1 min-h-0">
      <div className="flex-1 flex flex-col gap-3 min-w-0 min-h-0">
        <div className="border border-border rounded-sm bg-surface flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
            <span className="text-xs font-semibold text-text-primary">Nháp báo cáo do CAE hỗ trợ</span>
            {approved
              ? <span className="text-[10px] font-semibold text-semantic-success bg-semantic-success/10 border border-semantic-success/30 px-1.5 py-0.5 rounded-sm">✓ Đã duyệt</span>
              : <span className="text-[10px] font-semibold text-semantic-warning bg-semantic-warning/5 border border-semantic-warning/30 px-1.5 py-0.5 rounded-sm">Nháp · Chưa duyệt</span>}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {fields.map(f => {
              const ip = pending?.fieldKey === f.key;
              return (
                <div key={f.key}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <label className="text-[10px] font-semibold text-text-tertiary">{f.label}</label>
                    <span className={`text-[10px] px-1 py-0.5 bg-background-tertiary border border-border rounded-sm ${f.type === 'required' ? 'text-semantic-error' : 'text-text-tertiary'}`}>
                      {f.type === 'ai' ? 'AI đề xuất' : f.type === 'required' ? 'BS điền *' : 'Chỉ đọc'}
                    </span>
                    {f.modified && <span className="text-[10px] text-brand-primary font-medium ml-auto">● Đã sửa</span>}
                  </div>
                  {ip && pending && (
                    <div className="mb-1.5 border border-brand-primary/30 rounded-sm bg-brand-light/20 p-2">
                      <p className="text-[10px] font-semibold text-brand-primary mb-1.5">Đề xuất thay đổi:</p>
                      <p className="text-[11px] text-text-tertiary line-through leading-relaxed">{f.value}</p>
                      <p className="text-[11px] text-text-primary leading-relaxed mt-1">{pending.newValue}</p>
                      <div className="flex gap-1.5 mt-2">
                        <button onClick={acceptChange} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-sm bg-semantic-success text-white font-medium"><Check className="w-3 h-3" />Chấp nhận</button>
                        <button onClick={() => setPending(null)} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-sm border border-border text-text-secondary"><X className="w-3 h-3" />Bỏ qua</button>
                      </div>
                    </div>
                  )}
                  <textarea value={f.value}
                    onChange={e => { if (f.type !== 'readonly') setFields(fs => fs.map(x => x.key === f.key ? { ...x, value: e.target.value, modified: true } : x)); }}
                    rows={f.rows} readOnly={f.type === 'readonly' || approved}
                    placeholder={f.type === 'required' ? 'Bác sỹ nhập...' : undefined}
                    className={`w-full text-xs border rounded-sm px-2.5 py-2 leading-relaxed resize-none focus:outline-none focus:border-brand-primary ${
                      f.type === 'readonly' ? 'bg-background-secondary text-text-tertiary border-border cursor-default'
                      : f.modified ? 'bg-brand-light/10 border-brand-primary/30 text-text-primary'
                      : 'bg-background border-border text-text-primary placeholder:text-text-tertiary'}`}
                  />
                </div>
              );
            })}
          </div>
          {!approved && (
            <div className="shrink-0 border-t border-border px-3 py-2 flex items-center gap-2">
              <p className="text-[10px] text-text-tertiary flex-1">Đọc kỹ trước khi xác nhận.</p>
              <button className="text-xs px-3 py-1.5 rounded-sm border border-border text-text-secondary hover:bg-background-secondary">Xuất PDF</button>
              <button onClick={() => setApproved(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-sm bg-semantic-success text-white font-semibold hover:opacity-90">
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
      </div>
      {!approved && (
        <div className="w-56 shrink-0 border border-border rounded-sm bg-surface flex flex-col">
          <div className="px-3 py-2 border-b border-border shrink-0"><span className="text-xs font-semibold text-text-primary">CAE điều chỉnh nháp</span></div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0">
            {msgs.length === 0 && ['Thêm theo dõi SpO₂ mỗi 4 giờ', 'Viết lại gợi ý CĐ ngắn hơn', 'Thêm phổi trái bình thường'].map(s => (
              <button key={s} onClick={() => setInput(s)} className="w-full text-left text-[10px] px-2 py-1.5 border border-border rounded-sm text-text-secondary hover:bg-background-secondary hover:border-brand-primary transition-colors">{s}</button>
            ))}
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-full px-2 py-1.5 rounded-sm text-[11px] leading-relaxed ${m.role === 'user' ? 'bg-brand-primary text-white' : 'bg-background-secondary border border-border text-text-primary'}`}>{m.content}</div>
              </div>
            ))}
            {loading && <div className="flex justify-start"><div className="px-2 py-1.5 rounded-sm bg-background-secondary border border-border flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin text-text-tertiary" /><span className="text-[10px] text-text-tertiary">Xử lý...</span></div></div>}
            <div ref={endRef} />
          </div>
          <div className="shrink-0 border-t border-border p-2 flex gap-1.5">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Mô tả chỉnh sửa..." className="flex-1 text-[11px] border border-border rounded-sm px-2 py-1.5 bg-background focus:outline-none focus:border-brand-primary text-text-primary placeholder:text-text-tertiary" />
            <button onClick={handleSend} disabled={!input.trim() || loading || !!pending} className="w-7 h-7 flex items-center justify-center rounded-sm bg-brand-primary text-white disabled:opacity-40"><Send className="w-3 h-3" /></button>
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

  const [panelMode, setPanelMode] = useState<PanelMode>('wide');
  const [manualMode, setManualMode] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);
  const [openCitation, setOpenCitation] = useState<number | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [isLoadingEpisode, setIsLoadingEpisode] = useState(true);
  const [episodeError, setEpisodeError] = useState<string | null>(null);
  const [caseInfo, setCaseInfo] = useState<CaseInfo>(DEFAULT_CASE_INFO);
  const [liveCitations, setLiveCitations] = useState<Citation[]>(CITATIONS_DATA);

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

  // Map episode_id to corresponding PCXR sample
  // In production: fetch from Supabase based on episode_id
  const sampleIdx = EPISODE_TO_SAMPLE[id] ?? 0;
  const sample = PCXR_SAMPLES[sampleIdx];

  // Auto-switch panel width on step change unless user overrode
  useEffect(() => { if (!manualMode) setPanelMode(STEP_DEFAULT_MODE[step]); }, [step, manualMode]);

  const handleSetStep = (s: Step) => { setManualMode(false); setStep(s); };
  const handleSetMode = (m: PanelMode) => { setManualMode(true); setPanelMode(m); };

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />Worklist
          </Link>
          <ChevronRight className="w-3 h-3 text-text-tertiary" />
          <span className="text-xs font-semibold text-text-primary font-mono">{id}</span>
          <span className="text-[10px] text-text-tertiary">· {caseInfo.age} · {caseInfo.date}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Panel width presets */}
          <div className="flex items-center gap-0.5 border border-border rounded-sm p-0.5 bg-background-secondary">
            {([
              { mode: 'wide'     as PanelMode, g: '▐▐▌', tip: 'Ảnh rộng (54%)' },
              { mode: 'balanced' as PanelMode, g: '▐▌▌', tip: 'Cân bằng (44%)' },
              { mode: 'compact'  as PanelMode, g: '▌▌▐', tip: 'Text rộng (30%)' },
            ]).map(m => (
              <button key={m.mode} onClick={() => handleSetMode(m.mode)} title={m.tip}
                className={`px-2 py-1 rounded-sm text-[10px] font-mono tracking-widest transition-colors ${panelMode === m.mode ? 'bg-surface text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-secondary'}`}>
                {m.g}
              </button>
            ))}
          </div>
          {/* Step tabs */}
          <div className="flex items-center gap-0.5 border border-border rounded-sm p-0.5 bg-background-secondary">
            {STEPS.map((s, i) => {
              const isActive = step === s.key;
              const isDone = STEPS.findIndex(x => x.key === step) > i;
              const Icon = s.icon;
              return (
                <button key={s.key} onClick={() => handleSetStep(s.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium transition-colors ${isActive ? 'bg-surface text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-secondary'}`}>
                  {isDone ? <Check className="w-3.5 h-3.5 text-semantic-success" /> : <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-text-primary' : 'text-text-tertiary'}`} />}
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Two-panel workspace */}
      <div className="flex gap-3 flex-1 min-h-0">
        <ImagePanel
          widthPct={PANEL_WIDTHS[panelMode]}
          sample={sample}
          caseInfo={caseInfo}
          hoveredIdx={hoveredIdx}
          onHoverIdx={setHoveredIdx}
          focusedIdx={focusedIdx}
          onFocusIdx={setFocusedIdx}
          onFullscreen={() => setFullscreen(true)}
        />
        <div className="flex-1 min-w-0 flex flex-col gap-3 min-h-0">
          <CAEDock
            episodeId={id}
            currentStep={step}
            onActivityDetected={() => {
              // User is interacting with dock, prevent auto-transitions
            }}
          />
          {step === 'detection' && <DetectionPanel sample={sample} hoveredIdx={hoveredIdx} onHoverIdx={setHoveredIdx} focusedIdx={focusedIdx} onFocusIdx={setFocusedIdx} onNext={() => handleSetStep('explain')} />}
          {step === 'explain'   && <ExplainPanel episodeId={id} sample={sample} onNext={() => handleSetStep('draft')} onCitation={setOpenCitation} onCitationsLoaded={setLiveCitations} />}
          {step === 'draft'     && <DraftPanel episodeId={id} sample={sample} />}
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
