'use client';

import { Suspense, useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import { API_BASE_URL, getAuthToken } from '@/lib/api/client';

function KnowledgePdfViewInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const documentId = typeof params.documentId === 'string' ? params.documentId : '';
  const titleHint = searchParams.get('title')?.trim() || 'Tài liệu';

  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const revoke = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setBlobUrl(null);
  }, []);

  useEffect(() => {
    if (!documentId) {
      setPhase('error');
      setMessage('Thiếu mã tài liệu.');
      return;
    }

    let cancelled = false;

    async function load() {
      setPhase('loading');
      setMessage(null);
      revoke();

      try {
        const token = await getAuthToken();
        if (!token) {
          if (!cancelled) {
            setPhase('error');
            setMessage('Chưa đăng nhập — không thể tải PDF.');
          }
          return;
        }

        const res = await fetch(
          `${API_BASE_URL}/api/documents/${encodeURIComponent(documentId)}/source`,
          { method: 'GET', headers: { Authorization: `Bearer ${token}` } }
        );

        const contentType = res.headers.get('Content-Type') || '';

        if (!res.ok) {
          let errText = `HTTP ${res.status}`;
          if (contentType.includes('application/json')) {
            const body = (await res.json()) as { error?: { message?: string }; message?: string };
            errText = body.error?.message || body.message || errText;
          }
          if (!cancelled) {
            setPhase('error');
            setMessage(errText);
          }
          return;
        }

        if (!contentType.includes('application/pdf')) {
          if (!cancelled) {
            setPhase('error');
            setMessage('Máy chủ không trả về PDF hợp lệ.');
          }
          return;
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        blobUrlRef.current = url;
        setBlobUrl(url);
        setPhase('ready');
      } catch (e) {
        if (!cancelled) {
          setPhase('error');
          setMessage(e instanceof Error ? e.message : 'Lỗi mạng khi tải PDF');
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
      revoke();
    };
  }, [documentId, revoke]);

  return (
    <div className="flex flex-col gap-3 min-h-0 h-[calc(100dvh-7.5rem)]">
      <div className="flex items-center gap-3 shrink-0">
        <Link
          href="/knowledge"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-brand-primary border border-border rounded-sm px-2.5 py-1.5 bg-surface"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kho tri thức
        </Link>
        <h1 className="text-sm font-semibold text-text-primary truncate min-w-0" title={titleHint}>
          {titleHint}
        </h1>
      </div>

      {phase === 'loading' && (
        <div className="flex flex-1 min-h-[50vh] items-center justify-center gap-2 text-text-tertiary border border-border rounded-sm bg-surface">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Đang tải PDF…</span>
        </div>
      )}

      {phase === 'error' && message && (
        <div className="flex flex-1 min-h-[40vh] flex-col items-center justify-center gap-2 border border-semantic-error/30 rounded-sm bg-semantic-error/5 p-6 text-center">
          <AlertTriangle className="w-6 h-6 text-semantic-error" />
          <p className="text-sm text-semantic-error font-medium">Không mở được PDF</p>
          <p className="text-xs text-text-secondary max-w-md">{message}</p>
          <Link href="/knowledge" className="text-xs text-brand-primary font-semibold mt-2 hover:underline">
            Quay lại danh sách
          </Link>
        </div>
      )}

      {phase === 'ready' && blobUrl && (
        <div className="flex-1 min-h-0 border border-border rounded-sm bg-background-secondary overflow-hidden">
          <iframe title={titleHint} src={blobUrl} className="w-full h-full min-h-[65vh] border-0" />
        </div>
      )}
    </div>
  );
}

export default function KnowledgeDocumentPdfViewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 py-16 text-text-tertiary">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Đang tải…</span>
        </div>
      }
    >
      <KnowledgePdfViewInner />
    </Suspense>
  );
}
