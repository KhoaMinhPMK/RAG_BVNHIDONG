'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Download, FileText, Layers, AlertCircle, Loader2,
  ChevronDown, ChevronUp, ExternalLink, Calendar, Tag, User, Globe, Info, X,
} from 'lucide-react';
import { getDocumentDetail, getDocumentSignedUrl, API_BASE_URL } from '@/lib/api/client';
import type { DocumentDetail, DocumentChunk } from '@/lib/api/client';

type Tab = 'pdf' | 'chunks';

function Badge({ children, color = 'neutral' }: { children: React.ReactNode; color?: 'green' | 'amber' | 'neutral' | 'blue' }) {
  const cls = {
    green: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    blue: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
    neutral: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
  }[color];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}

function MetaRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 text-sm text-gray-500">
      <span className="text-gray-400 flex-shrink-0">{icon}</span>
      <span className="text-gray-400 w-20 flex-shrink-0">{label}</span>
      <span className="text-gray-700 font-medium">{value}</span>
    </div>
  );
}

function ChunkCard({ chunk, index }: { chunk: DocumentChunk; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const preview = chunk.content.slice(0, 280);
  const hasMore = chunk.content.length > 280;

  return (
    <div className="border border-gray-100 rounded-xl bg-white hover:border-gray-200 transition-colors">
      <div className="flex items-start gap-3 p-4">
        <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-xs font-mono text-gray-400">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {expanded ? chunk.content : preview}
            {!expanded && hasMore && <span className="text-gray-400">…</span>}
          </p>
          {hasMore && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="mt-2 flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
            >
              {expanded ? <><ChevronUp className="w-3 h-3" /> Thu gọn</> : <><ChevronDown className="w-3 h-3" /> Xem thêm</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * PdfViewer: Fetches the PDF via the same-origin proxy as a Blob, then creates
 * a local blob: URL for the iframe.  This sidesteps all cross-origin / CSP
 * frame-ancestor issues because the iframe src is always blob: (same origin).
 */
function PdfViewer({
  proxyUrl,
  signedUrl,
  onDownload,
}: {
  proxyUrl: string | null;
  signedUrl: string | null;
  onDownload: () => void;
}) {
  type ViewState = 'fetching' | 'ready' | 'failed';
  const [viewState, setViewState] = useState<ViewState>('fetching');
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const prevBlobUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!proxyUrl) return;
    setViewState('fetching');
    setBlobUrl(null);

    let aborted = false;
    const controller = new AbortController();

    fetch(proxyUrl, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (aborted) return;
        // Revoke previous blob URL to free memory
        if (prevBlobUrl.current) URL.revokeObjectURL(prevBlobUrl.current);
        const url = URL.createObjectURL(blob);
        prevBlobUrl.current = url;
        setBlobUrl(url);
        setViewState('ready');
      })
      .catch(() => {
        if (!aborted) setViewState('failed');
      });

    return () => {
      aborted = true;
      controller.abort();
    };
  }, [proxyUrl]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (prevBlobUrl.current) URL.revokeObjectURL(prevBlobUrl.current);
    };
  }, []);

  if (!proxyUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
        <FileText className="w-10 h-10 text-gray-300" />
        <p className="text-sm text-gray-500 text-center">
          File PDF chưa có trên Storage.<br />
          Tải lại tài liệu để kích hoạt xem PDF.
        </p>
      </div>
    );
  }

  const openUrl = signedUrl ?? proxyUrl;

  const fallback = (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="text-center">
        <p className="font-medium text-gray-700 text-sm">Không thể hiển thị PDF trong trang này.</p>
        <p className="text-xs text-gray-400 mt-1">Mở tab mới hoặc tải về để xem.</p>
      </div>
      <div className="flex gap-3">
        <a
          href={openUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
        >
          <ExternalLink className="w-4 h-4" /> Mở tab mới
        </a>
        <button
          onClick={onDownload}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Download className="w-4 h-4" /> Tải về
        </button>
      </div>
    </div>
  );

  if (viewState === 'failed') return fallback;

  return (
    <div className="relative w-full h-full" style={{ minHeight: 320 }}>
      {viewState === 'fetching' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 rounded-xl z-10 gap-4">
          <div className="flex flex-col items-center gap-3 text-gray-400">
            <Loader2 className="w-7 h-7 animate-spin" />
            <span className="text-sm">Đang tải tài liệu…</span>
          </div>
          <a
            href={openUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Mở trong tab mới
          </a>
        </div>
      )}
      {/* blob: URL is always same-origin → Chrome PDF viewer renders correctly */}
      {blobUrl && (
        <iframe
          key={blobUrl}
          src={blobUrl}
          className="absolute inset-0 w-full h-full rounded-xl border border-gray-100"
          title="Document PDF Viewer"
        />
      )}
    </div>
  );
}

export default function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  // signedUrl: for download/open-tab buttons only
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  // pdfAvailable: true when backend confirms the file exists in storage
  const [pdfAvailable, setPdfAvailable] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('pdf');
  const [loading, setLoading] = useState(true);
  const [urlLoading, setUrlLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlExpiry = useRef<number>(0);

  // Proxy URL — same-origin, no cross-origin iframe issues
  const proxyPdfUrl = id ? `${API_BASE_URL}/api/documents/${id}/pdf` : null;

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getDocumentDetail(id)
      .then(res => {
        if (res?.success && res.document) {
          setDoc(res.document);
          setChunks(res.chunks ?? []);
        } else {
          setError('Không tìm thấy tài liệu.');
        }
      })
      .catch(() => setError('Lỗi tải tài liệu.'))
      .finally(() => setLoading(false));
  }, [id]);

  const fetchSignedUrl = useCallback(async () => {
    if (!id) return;
    if (signedUrl && Date.now() < urlExpiry.current) return;
    setUrlLoading(true);
    const res = await getDocumentSignedUrl(id).catch(() => null);
    if (res?.signed_url) {
      setSignedUrl(res.signed_url);
      setPdfAvailable(true);
      urlExpiry.current = Date.now() + (res.expires_in - 60) * 1000;
    } else {
      setSignedUrl(null);
      setPdfAvailable(false);
    }
    setUrlLoading(false);
  }, [id, signedUrl]);

  useEffect(() => {
    if (tab === 'pdf') fetchSignedUrl();
  }, [tab, id]);

  const handleDownload = () => {
    // Download via proxy so auth header is included
    const a = document.createElement('a');
    a.href = proxyPdfUrl ?? (signedUrl ?? '');
    a.download = `${doc?.title ?? 'document'}.pdf`;
    a.click();
  };

  const [infoOpen, setInfoOpen] = useState(false);

  const statusColor = (s?: string): 'green' | 'amber' | 'neutral' =>
    s === 'active' ? 'green' : s === 'superseded' ? 'amber' : 'neutral';

  if (loading) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="text-sm">Đang tải…</span>
        </div>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-gray-400">
          <AlertCircle className="w-10 h-10 text-amber-400" />
          <p className="text-gray-600">{error ?? 'Không tìm thấy tài liệu.'}</p>
          <button onClick={() => router.back()} className="text-sm text-indigo-500 hover:underline">Quay lại</button>
        </div>
      </div>
    );
  }

  const hasPdf = pdfAvailable !== false && proxyPdfUrl;

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">

      {/* ── Compact top bar ── */}
      <header className="flex-none h-11 border-b border-gray-100 bg-white flex items-center px-4 gap-3 z-30">
        {/* Back */}
        <button
          onClick={() => router.push('/knowledge')}
          className="flex items-center gap-1.5 text-gray-400 hover:text-gray-700 transition-colors flex-none"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-gray-200 flex-none" />

        {/* Icon + title */}
        <FileText className="w-4 h-4 text-indigo-400 flex-none" />
        <h1 className="text-sm font-medium text-gray-800 truncate flex-1 min-w-0">{doc.title}</h1>

        {/* Tab pills */}
        <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5 flex-none">
          {([
            { key: 'pdf' as const, label: 'PDF' },
            { key: 'chunks' as const, label: `Nội dung` },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                tab === t.key
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-gray-200 flex-none" />

        {/* Info button */}
        <button
          onClick={() => setInfoOpen(v => !v)}
          className={`p-1.5 rounded-lg transition-colors flex-none ${infoOpen ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
          title="Thông tin tài liệu"
        >
          <Info className="w-4 h-4" />
        </button>

        {/* Actions */}
        {hasPdf && (
          <>
            <a
              href={signedUrl ?? proxyPdfUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-none"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Mở tab mới
            </a>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors flex-none"
            >
              <Download className="w-3.5 h-3.5" /> Tải về
            </button>
          </>
        )}
        {urlLoading && !hasPdf && (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400 flex-none" />
        )}
      </header>

      {/* ── Body ── */}
      <div className="flex-1 relative overflow-hidden">

        {/* PDF tab — full height */}
        {tab === 'pdf' && (
          <div className="h-full max-w-6xl mx-auto px-4 py-3">
            <PdfViewer
              proxyUrl={hasPdf ? proxyPdfUrl : null}
              signedUrl={signedUrl}
              onDownload={handleDownload}
            />
          </div>
        )}

        {/* Chunks tab — scrollable */}
        {tab === 'chunks' && (
          <div className="h-full overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 py-6">
              {chunks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
                  <Layers className="w-8 h-8 text-gray-300" />
                  <p className="text-sm">Chưa có đoạn nội dung nào được lập chỉ mục.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">{chunks.length} đoạn văn bản</p>
                  {chunks.map((chunk, i) => (
                    <ChunkCard key={chunk.id} chunk={chunk} index={i} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Info drawer overlay ── */}
        {infoOpen && (
          <>
            {/* Backdrop */}
            <div
              className="absolute inset-0 z-40"
              onClick={() => setInfoOpen(false)}
            />
            {/* Panel */}
            <aside className="absolute top-0 right-0 h-full w-80 bg-white border-l border-gray-100 shadow-xl z-50 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-800">Thông tin tài liệu</span>
                <button onClick={() => setInfoOpen(false)} className="text-gray-400 hover:text-gray-700 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
                {/* Title + badges */}
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-2">Tên tài liệu</p>
                  <p className="text-sm text-gray-800 font-medium leading-snug">{doc.title}</p>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <Badge color={statusColor(doc.status)}>
                      {doc.status === 'active' ? 'Hiệu lực' : doc.status === 'superseded' ? 'Đã thay thế' : doc.status}
                    </Badge>
                    {doc.version && <Badge color="blue">v{doc.version}</Badge>}
                    {doc.language && <Badge>{doc.language.toUpperCase()}</Badge>}
                    {chunks.length > 0 && <Badge><Layers className="w-3 h-3 mr-1 inline" />{chunks.length} đoạn</Badge>}
                  </div>
                </div>

                {/* Meta fields */}
                <div className="flex flex-col gap-3">
                  <MetaRow icon={<Calendar className="w-3.5 h-3.5" />} label="Ngày hiệu lực" value={doc.effective_date ?? undefined} />
                  <MetaRow icon={<Tag className="w-3.5 h-3.5" />} label="Nguồn" value={doc.source ?? undefined} />
                  <MetaRow icon={<User className="w-3.5 h-3.5" />} label="Tác giả / Tổ chức" value={doc.owner ?? undefined} />
                  <MetaRow icon={<Globe className="w-3.5 h-3.5" />} label="Nhóm tuổi" value={doc.age_group ?? undefined} />
                </div>
              </div>
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
