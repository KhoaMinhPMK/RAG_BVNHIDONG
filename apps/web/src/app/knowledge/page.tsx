'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload, BookOpen, Check, Clock, AlertTriangle, Search, Loader2,
  FileText, Layers, Database, Inbox, Wifi, WifiOff, X, Trash2,
  ChevronDown, Plus, RefreshCw, CheckCircle2, Eye,
} from 'lucide-react';
import * as apiClient from '@/lib/api/client';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ApiDocument {
  id: string;
  title: string;
  version?: string;
  source?: string;
  status: string;
  chunk_count: number;
  effective_date?: string;
  created_at?: string;
}

interface SystemHealth {
  status: 'ok' | 'degraded' | 'error';
  services: {
    supabase: { status: string };
    cae: { status: string; provider?: string; model?: string };
    ollama: { status: string; model: string };
    mimo: { status: string; model: string };
    embedding: { status: string; model: string; dim: number };
  };
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SOURCE_OPTIONS = ['WHO', 'BTS', 'BYT', 'PubMed', 'Internal', 'Other'];

const INGESTION_STAGE_LABELS: Record<
  'pending' | 'parsing' | 'chunking' | 'embedding' | 'storing' | 'completed' | 'failed',
  string
> = {
  pending: 'Đang xếp hàng ingest',
  parsing: 'Đang đọc PDF và trích xuất nội dung',
  chunking: 'Đang chia tài liệu thành các chunk',
  embedding: 'Đang tạo embedding cho chunks',
  storing: 'Đang lưu chunks và vectors vào database',
  completed: 'Hoàn tất ingest tài liệu',
  failed: 'Ingest thất bại',
};

const statusConfig: Record<string, {
  label: string; color: string; bg: string; border: string;
  icon: typeof Check;
}> = {
  active:  { label: 'Active',      color: 'text-semantic-success', bg: 'bg-semantic-success/10', border: 'border-semantic-success/30',  icon: Check },
  pending: { label: 'Chờ duyệt',   color: 'text-semantic-warning', bg: 'bg-semantic-warning/10', border: 'border-semantic-warning/30',  icon: Clock },
  error:   { label: 'Lỗi',         color: 'text-semantic-error',   bg: 'bg-semantic-error/10',   border: 'border-semantic-error/30',    icon: AlertTriangle },
};

function cleanSource(raw: string): string {
  const name = raw.replace(/\\/g, '/').split('/').pop() ?? raw;
  return name.replace(/\.[^.]+$/, '').replace(/_/g, ' ');
}

// ─── Service Status Pill ────────────────────────────────────────────────────

function ServicePill({
  label, status, model, dim,
}: { label: string; status: string; model?: string; dim?: number }) {
  const ok = status === 'connected' || status === 'ready';
  const degraded = status === 'degraded';
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-sm border text-[10px] font-medium
      ${ok
        ? 'bg-semantic-success/10 border-semantic-success/30 text-semantic-success'
        : degraded
          ? 'bg-semantic-warning/10 border-semantic-warning/30 text-semantic-warning'
          : 'bg-semantic-error/10 border-semantic-error/30 text-semantic-error'}`}>
      {ok ? <Wifi className="w-3 h-3" /> : degraded ? <AlertTriangle className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
      <span>{label}</span>
      {model && <span className="opacity-60 font-mono">· {model}{dim ? ` · ${dim}d` : ''}</span>}
    </div>
  );
}

// ─── Upload Modal ───────────────────────────────────────────────────────────
interface UploadModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface IngestionJobState {
  id: string;
  status: 'pending' | 'parsing' | 'chunking' | 'embedding' | 'storing' | 'completed' | 'failed';
  progress: number;
  total_chunks?: number;
  processed_chunks?: number;
  error?: string;
  message?: string;
  document_id?: string;
  result?: {
    success: boolean;
    document_id: string;
    chunks_created: number;
    embeddings_created: number;
    total_tokens: number;
    duration_ms: number;
    error?: string;
  };
}

function UploadModal({ onClose, onSuccess }: UploadModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [source, setSource] = useState('');
  const [trustLevel, setTrustLevel] = useState<'internal' | 'reference'>('reference');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<{ chunks: number; tokens: number; ms: number } | null>(null);
  const [errMsg, setErrMsg] = useState('');
  const [job, setJob] = useState<IngestionJobState | null>(null);

  const handleFile = (f: File) => {
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' '));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === 'application/pdf') handleFile(f);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setStatus('uploading');
    setErrMsg('');
    setResult(null);
    setJob(null);

    const res = await apiClient.uploadDocument({
      file,
      title: title.trim() || undefined,
      source: trustLevel === 'reference' ? source || undefined : undefined,
      effective_date: effectiveDate || undefined,
      trust_level: trustLevel,
    });

    if (res.success) {
      setJob({
        id: res.job_id,
        status: 'pending',
        progress: 0,
        message: res.message,
      });
    } else {
      setErrMsg((res as any).error?.message || 'Upload thất bại');
      setStatus('error');
    }
  };

  useEffect(() => {
    if (!job?.id || status !== 'uploading') {
      return;
    }

    let cancelled = false;

    const pollJob = async () => {
      const response = await apiClient.getDocumentIngestionJob(job.id);

      if (cancelled) {
        return;
      }

      if (!response.success || !response.job) {
        setErrMsg(response.error?.message || 'Không thể đọc tiến độ ingest');
        setStatus('error');
        return;
      }

      const nextJob = response.job;
      setJob(nextJob);

      if (nextJob.status === 'completed') {
        const jobResult = nextJob.result;
        setResult({
          chunks: jobResult?.chunks_created ?? nextJob.total_chunks ?? 0,
          tokens: jobResult?.total_tokens ?? 0,
          ms: jobResult?.duration_ms ?? 0,
        });
        setStatus('done');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1800);
        return;
      }

      if (nextJob.status === 'failed') {
        setErrMsg(nextJob.error || nextJob.message || 'Ingest thất bại');
        setStatus('error');
        return;
      }

      pollTimeoutRef.current = setTimeout(pollJob, 1000);
    };

    pollJob();

    return () => {
      cancelled = true;
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };
  }, [job?.id, onClose, onSuccess, status]);

  const currentStageLabel = job ? INGESTION_STAGE_LABELS[job.status] : 'Đang khởi tạo ingest';
  const currentStageMessage = job?.message || 'Đang chuẩn bị pipeline parse -> chunk -> embed -> lưu DB';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-surface border border-border rounded-sm shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-brand-primary" />
            <span className="text-sm font-semibold text-text-primary">Tải lên tài liệu PDF</span>
          </div>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Drop zone */}
          <div
            className={`relative border-2 border-dashed rounded-sm p-6 text-center cursor-pointer transition-colors
              ${dragging ? 'border-brand-primary bg-brand-light/30' : 'border-border hover:border-brand-primary/50 hover:bg-background-secondary'}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            {file ? (
              <div className="flex flex-col items-center gap-1">
                <FileText className="w-8 h-8 text-brand-primary" />
                <p className="text-xs font-medium text-text-primary truncate max-w-xs">{file.name}</p>
                <p className="text-[10px] text-text-tertiary">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-text-tertiary opacity-50" />
                <p className="text-xs text-text-tertiary">Kéo thả hoặc <span className="text-brand-primary underline">chọn file PDF</span></p>
                <p className="text-[10px] text-text-tertiary opacity-60">Tối đa 50 MB</p>
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1 block">Tiêu đề</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Tiêu đề tài liệu"
                className="w-full text-xs px-3 py-2 border border-border rounded-sm bg-background-secondary text-text-primary placeholder:text-text-tertiary outline-none focus:border-brand-primary transition-colors"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1 block">Mức tin cậy tài liệu</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTrustLevel('reference')}
                    className={`text-xs px-3 py-2 rounded-sm border text-left transition-colors ${trustLevel === 'reference' ? 'border-brand-primary bg-brand-light/20 text-brand-primary' : 'border-border text-text-secondary hover:bg-background-secondary'}`}
                  >
                    Tài liệu tham khảo ngoài
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrustLevel('internal')}
                    className={`text-xs px-3 py-2 rounded-sm border text-left transition-colors ${trustLevel === 'internal' ? 'border-semantic-warning/40 bg-semantic-warning/10 text-semantic-warning' : 'border-border text-text-secondary hover:bg-background-secondary'}`}
                  >
                    Tài liệu nội bộ bệnh viện
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1 block">Nguồn</label>
                <div className="relative">
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    disabled={trustLevel === 'internal'}
                    className="w-full text-xs px-3 py-2 border border-border rounded-sm bg-background-secondary text-text-primary outline-none focus:border-brand-primary transition-colors appearance-none pr-7 disabled:opacity-50"
                  >
                    <option value="">— Chọn —</option>
                    {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-tertiary pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1 block">Ngày hiệu lực</label>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-border rounded-sm bg-background-secondary text-text-primary outline-none focus:border-brand-primary transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Status / result */}
          {status === 'uploading' && (
            <div className="rounded-sm border border-brand-primary/20 bg-brand-light/10 px-3 py-3 space-y-2">
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <Loader2 className="w-4 h-4 animate-spin text-brand-primary" />
                <span>{currentStageLabel}</span>
                {job && <span className="ml-auto font-mono text-[10px] text-brand-primary">{job.progress}%</span>}
              </div>
              <div className="h-1.5 rounded-full bg-brand-primary/10 overflow-hidden">
                <div
                  className="h-full bg-brand-primary transition-all duration-300"
                  style={{ width: `${job?.progress ?? 0}%` }}
                />
              </div>
              <div className="flex items-center justify-between gap-3 text-[10px] text-text-tertiary">
                <span>{currentStageMessage}</span>
                {job?.total_chunks ? (
                  <span className="font-mono">
                    {job.processed_chunks ?? 0}/{job.total_chunks} chunks
                  </span>
                ) : null}
              </div>
            </div>
          )}
          {status === 'done' && result && (
            <div className="flex items-center gap-2 text-xs text-semantic-success bg-semantic-success/10 border border-semantic-success/30 rounded-sm px-3 py-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{result.chunks} chunks · {result.tokens.toLocaleString()} tokens · {(result.ms / 1000).toFixed(1)}s</span>
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-center gap-2 text-xs text-semantic-error bg-semantic-error/10 border border-semantic-error/30 rounded-sm px-3 py-2">
              <AlertTriangle className="w-4 h-4" />
              <span>{errMsg}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 justify-end pt-1">
            <button
              onClick={onClose}
              className="text-xs px-4 py-2 border border-border rounded-sm text-text-secondary hover:bg-background-secondary transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handleSubmit}
              disabled={!file || status === 'uploading' || status === 'done'}
              className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-sm bg-brand-primary text-white font-semibold
                disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              {status === 'uploading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {status === 'uploading' ? 'Đang xử lý…' : 'Tải lên & Embedding'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function KnowledgePage() {
  const router = useRouter();
  const [docs, setDocs] = useState<ApiDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    setError(null);
    apiClient.getDocuments()
      .then((res: { success: boolean; documents?: ApiDocument[]; total?: number } | null) => {
        if (res?.success) {
          setDocs(res.documents ?? []);
          setTotal(res.total ?? 0);
        } else if (res && !res.success) {
          setError('Không thể tải danh sách tài liệu');
        }
      })
      .catch(() => setError('Không thể tải danh sách tài liệu'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadDocs();
    apiClient.getSystemHealth().then((h) => setHealth(h as SystemHealth));
  }, [loadDocs]);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Xóa tài liệu "${title}" và toàn bộ chunks? Thao tác không thể hoàn tác.`)) return;
    setDeletingId(id);
    const res = await apiClient.deleteDocument(id);
    setDeletingId(null);
    if (res.success) loadDocs();
    else alert('Xóa thất bại: ' + (res.error?.message || 'Unknown error'));
  };

  const activeDocs   = docs.filter((d) => d.status === 'active');
  const totalChunks  = docs.reduce((s, d) => s + (d.chunk_count ?? 0), 0);
  const uniqueSources = [...new Set(docs.map((d) => d.source).filter(Boolean))];

  const filteredDocs = search.trim()
    ? docs.filter((d) => d.title.toLowerCase().includes(search.toLowerCase()))
    : docs;

  const stats = [
    {
      label: 'Tài liệu', value: loading ? '—' : String(total),
      sub: loading ? '' : `${activeDocs.length} active · ${total - activeDocs.length} pending`,
      icon: FileText, accent: 'text-brand-primary', accentBg: 'bg-brand-light',
    },
    {
      label: 'Chunks', value: loading ? '—' : String(totalChunks),
      sub: 'pgvector · 768-dim',
      icon: Layers, accent: 'text-semantic-info', accentBg: 'bg-semantic-info/10',
    },
    {
      label: 'Nguồn', value: loading ? '—' : String(uniqueSources.length),
      sub: loading ? '' : uniqueSources.map((s) => cleanSource(s!)).join(', ') || '—',
      icon: Database, accent: 'text-semantic-warning', accentBg: 'bg-semantic-warning/10',
    },
    {
      label: 'Queue', value: '0',
      sub: 'Không có job đang chờ',
      icon: Inbox, accent: 'text-text-tertiary', accentBg: 'bg-background-tertiary',
    },
  ];

  return (
    <>
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSuccess={loadDocs}
        />
      )}

      <div className="flex flex-col gap-4 h-full">

        {/* ─── Header + toolbar ─── */}
        <div className="flex flex-col gap-2">
          {/* Row 1: title + actions */}
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-semibold text-text-primary">Kho tri thức</h1>
              <p className="text-[11px] text-text-tertiary mt-0.5">
                {loading ? 'Đang tải…' : `${total} tài liệu · ${totalChunks} chunks · ${uniqueSources.length} nguồn`}
              </p>
            </div>
            {/* Search */}
            <div className="flex items-center gap-2 border border-border rounded-sm bg-surface px-3 py-1.5 w-44 shrink-0">
              <Search className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm kiếm…"
                className="flex-1 text-xs text-text-primary placeholder:text-text-tertiary bg-transparent outline-none"
              />
            </div>
            {/* Refresh */}
            <button
              onClick={loadDocs}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 border border-border rounded-sm text-text-secondary bg-surface hover:bg-background-secondary transition-colors shrink-0"
              title="Làm mới"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {/* Upload */}
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-sm bg-brand-primary text-white font-semibold hover:opacity-90 transition-opacity shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Tải lên
            </button>
          </div>

          {/* Row 2: service status pills */}
          {health && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <ServicePill label="DB"        status={health.services.supabase.status} />
              <ServicePill label="CAE"       status={health.services.cae?.status || 'disconnected'} model={[health.services.cae?.provider, health.services.cae?.model].filter(Boolean).join(' · ')} />
              <ServicePill label="Ollama"    status={health.services.ollama.status}   model={health.services.ollama.model} />
              <ServicePill label="MiMo"      status={health.services.mimo?.status || 'disconnected'} model={health.services.mimo?.model} />
              <ServicePill label="Embedding" status={health.services.embedding.status} model={health.services.embedding.model} dim={health.services.embedding.dim} />
            </div>
          )}
        </div>

        {/* ─── Stats row ─── */}
        <div className="grid grid-cols-4 gap-3">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="border border-border rounded-sm bg-surface px-4 py-3 flex items-start gap-3">
                <div className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 ${s.accentBg}`}>
                  <Icon className={`w-4 h-4 ${s.accent}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-text-tertiary font-medium uppercase tracking-wider">{s.label}</p>
                  <p className="text-xl font-bold text-text-primary leading-tight mt-0.5">{s.value}</p>
                  <p className="text-[10px] text-text-tertiary mt-0.5 truncate" title={s.sub}>{s.sub}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── Documents table ─── */}
        <div className="border border-border rounded-sm bg-surface flex-1 flex flex-col min-h-0">
          {/* Table header bar */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
            <BookOpen className="w-3.5 h-3.5 text-text-tertiary" />
            <span className="text-xs font-semibold text-text-primary">Danh sách tài liệu</span>
            {!loading && (
              <span className="ml-1 text-[10px] font-mono px-1.5 py-0.5 bg-background-tertiary border border-border rounded-sm text-text-tertiary">
                {filteredDocs.length}
              </span>
            )}
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_110px_64px_56px_90px_80px_36px_36px] gap-2 px-4 py-2 border-b border-border bg-background-secondary">
            {['Tên tài liệu', 'Nguồn', 'Phiên bản', 'Chunks', 'Ngày hiệu lực', 'Trạng thái', '', ''].map((h, i) => (
              <span key={i} className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider truncate">
                {h}
              </span>
            ))}
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-10 text-text-tertiary">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">Đang tải tài liệu…</span>
              </div>
            )}
            {error && (
              <div className="flex items-center justify-center gap-2 py-10">
                <AlertTriangle className="w-4 h-4 text-semantic-error" />
                <span className="text-xs text-semantic-error">{error}</span>
              </div>
            )}
            {!loading && !error && filteredDocs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-text-tertiary">
                <BookOpen className="w-6 h-6 opacity-40" />
                <span className="text-xs">{search ? 'Không tìm thấy tài liệu nào' : 'Chưa có tài liệu nào trong kho'}</span>
                {!search && (
                  <button
                    onClick={() => setShowUpload(true)}
                    className="mt-1 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-sm bg-brand-primary text-white font-semibold hover:opacity-90 transition-opacity"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tải lên tài liệu đầu tiên
                  </button>
                )}
              </div>
            )}
            {!loading && filteredDocs.map((doc) => {
              const s = statusConfig[doc.status] ?? statusConfig['pending'];
              const Icon = s.icon;
              const dateStr = (doc.effective_date ?? doc.created_at)?.slice(0, 10) ?? '—';
              const sourceClean = doc.source ? cleanSource(doc.source) : '—';
              const isDeleting = deletingId === doc.id;
              return (
                <div
                  key={doc.id}
                  onClick={() => !isDeleting && router.push(`/knowledge/${doc.id}`)}
                  className={`grid grid-cols-[1fr_110px_64px_56px_90px_80px_36px_36px] gap-2 px-4 py-3 transition-colors items-center group cursor-pointer
                    ${isDeleting ? 'opacity-40 cursor-default' : 'hover:bg-background-secondary'}`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-text-primary truncate group-hover:text-brand-primary transition-colors">
                      {doc.title}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-sm border text-[10px] font-medium ${doc.source === 'Internal' ? 'bg-semantic-warning/10 border-semantic-warning/30 text-semantic-warning' : 'bg-semantic-info/10 border-semantic-info/30 text-semantic-info'}`}>
                      {doc.source === 'Internal' ? 'Noi bo' : 'Tham khao'}
                    </span>
                    <p className="text-[11px] text-text-secondary truncate mt-1" title={doc.source ?? undefined}>{sourceClean}</p>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 bg-background-tertiary border border-border rounded-sm text-text-tertiary w-fit font-mono">
                    {doc.version ?? 'v1.0'}
                  </span>
                  <p className="text-[11px] font-mono text-text-tertiary tabular-nums">
                    {doc.chunk_count > 0 ? doc.chunk_count : '—'}
                  </p>
                  <p className="text-[10px] text-text-tertiary font-mono">{dateStr}</p>
                  <div className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-sm border w-fit ${s.bg} ${s.border}`}>
                    <Icon className={`w-3 h-3 ${s.color}`} />
                    <span className={`text-[10px] font-medium ${s.color}`}>{s.label}</span>
                  </div>
                  {/* View */}
                  <button
                    onClick={(e) => { e.stopPropagation(); router.push(`/knowledge/${doc.id}`); }}
                    className="flex items-center justify-center w-7 h-7 rounded-sm text-text-tertiary hover:text-brand-primary hover:bg-brand-primary/10 transition-colors opacity-0 group-hover:opacity-100"
                    title="Xem tài liệu"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  {/* Delete */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(doc.id, doc.title); }}
                    disabled={isDeleting}
                    className="flex items-center justify-center w-7 h-7 rounded-sm text-text-tertiary hover:text-semantic-error hover:bg-semantic-error/10 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-40"
                    title="Xóa tài liệu"
                  >
                    {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

