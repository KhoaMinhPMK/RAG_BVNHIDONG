'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChevronDown, Lock, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import type { ReportVersion, LockStatus } from '@/lib/api/sessions';
import {
  getVersionHistory,
  checkLock,
  acquireLock,
  releaseLock,
  saveVersion,
  submitReport,
  approveReport,
  rejectReport,
} from '@/lib/api/sessions';

type DraftStatus = 'draft' | 'under_review' | 'edited' | 'approved' | 'rejected' | 'archived';

interface Props {
  draftId: string;
  status: DraftStatus;
  currentVersion: number;
  blocks: unknown;
  episodeId?: string;
  onStatusChange?: () => void;
}

const STATUS_LABEL: Record<DraftStatus, string> = {
  draft: 'Bản nháp',
  under_review: 'Chờ duyệt',
  edited: 'Đã chỉnh sửa',
  approved: 'Đã duyệt',
  rejected: 'Bị từ chối',
  archived: 'Lưu trữ',
};

const STATUS_COLOR: Record<DraftStatus, string> = {
  draft: 'text-neutral-400',
  under_review: 'text-amber-400',
  edited: 'text-blue-400',
  approved: 'text-green-400',
  rejected: 'text-red-400',
  archived: 'text-neutral-600',
};

export function ReportVersionBar({
  draftId,
  status,
  currentVersion,
  blocks,
  episodeId,
  onStatusChange,
}: Props) {
  const [versions, setVersions] = useState<ReportVersion[]>([]);
  const [lock, setLock] = useState<LockStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [showVersions, setShowVersions] = useState(false);

  const loadMeta = useCallback(async () => {
    const [vHistory, lockData] = await Promise.allSettled([
      getVersionHistory(draftId),
      checkLock(draftId),
    ]);
    if (vHistory.status === 'fulfilled') setVersions(vHistory.value.versions);
    if (lockData.status === 'fulfilled') setLock(lockData.value.lock);
  }, [draftId]);

  useEffect(() => {
    loadMeta();
    // Poll lock status every 30s
    const t = setInterval(loadMeta, 30000);
    return () => clearInterval(t);
  }, [loadMeta]);

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      await saveVersion(draftId, {
        blocks: Array.isArray(blocks) ? blocks as unknown[] : [],
        action: 'user_edited',
      });
      await loadMeta();
      onStatusChange?.();
    } catch (e: any) {
      setError(e.message ?? 'Lỗi lưu phiên bản');
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      await submitReport(draftId);
      await loadMeta();
      onStatusChange?.();
    } catch (e: any) {
      setError(e.message ?? 'Lỗi gửi duyệt');
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove() {
    setBusy(true);
    setError(null);
    try {
      await approveReport(draftId);
      await loadMeta();
      onStatusChange?.();
    } catch (e: any) {
      setError(e.message ?? 'Lỗi duyệt báo cáo');
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!rejectNote.trim()) {
      setError('Vui lòng nhập lý do từ chối');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await rejectReport(draftId, rejectNote.trim());
      setShowReject(false);
      setRejectNote('');
      await loadMeta();
      onStatusChange?.();
    } catch (e: any) {
      setError(e.message ?? 'Lỗi từ chối báo cáo');
    } finally {
      setBusy(false);
    }
  }

  const isLocked = lock != null && lock.lockedBy != null && !lock.acquired;

  return (
    <div className="flex flex-col gap-0 border-b border-white/[0.06]">
      {/* Main bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-neutral-950/60">
        {/* Status */}
        <div className="flex items-center gap-1.5">
          <StatusIcon status={status} />
          <span className={`text-xs font-medium ${STATUS_COLOR[status]}`}>
            {STATUS_LABEL[status]}
          </span>
        </div>

        {/* Version selector */}
        <button
          onClick={() => setShowVersions((v) => !v)}
          className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <span>v{currentVersion}</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${showVersions ? 'rotate-180' : ''}`} />
        </button>

        {/* Lock indicator */}
        {isLocked && (
          <span className="flex items-center gap-1 text-xs text-amber-400">
            <Lock className="w-3 h-3" />
            Đang bị khóa
          </span>
        )}

        <div className="flex-1" />

        {/* Action buttons */}
        {!isLocked && (
          <div className="flex items-center gap-2">
            {(status === 'draft' || status === 'edited') && (
              <ActionButton onClick={handleSave} disabled={busy} label="Lưu phiên bản" />
            )}
            {(status === 'draft' || status === 'edited' || status === 'rejected') && (
              <ActionButton
                onClick={handleSubmit}
                disabled={busy}
                label="Gửi duyệt"
                variant="primary"
              />
            )}
            {status === 'under_review' && (
              <>
                <ActionButton
                  onClick={handleApprove}
                  disabled={busy}
                  label="Duyệt"
                  variant="success"
                />
                <ActionButton
                  onClick={() => setShowReject(true)}
                  disabled={busy}
                  label="Từ chối"
                  variant="danger"
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Error bar */}
      {error && (
        <div className="px-4 py-1.5 bg-red-500/10 border-t border-red-500/20 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Reject dialog */}
      {showReject && (
        <div className="px-4 py-2.5 bg-neutral-900 border-t border-white/[0.06] flex items-center gap-2">
          <input
            type="text"
            placeholder="Lý do từ chối..."
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-brand-primary/40"
          />
          <ActionButton onClick={handleReject} disabled={busy} label="Xác nhận" variant="danger" />
          <ActionButton
            onClick={() => { setShowReject(false); setRejectNote(''); }}
            disabled={busy}
            label="Hủy"
          />
        </div>
      )}

      {/* Version dropdown */}
      {showVersions && versions.length > 0 && (
        <div className="border-t border-white/[0.06] bg-neutral-950/80 max-h-48 overflow-y-auto">
          {versions.map((v) => (
            <div
              key={v.id}
              className={`flex items-center gap-3 px-4 py-2 text-xs hover:bg-white/5 transition-colors
                ${v.version === currentVersion ? 'text-white bg-white/5' : 'text-neutral-400'}
              `}
            >
              <span className="font-mono w-6">v{v.version}</span>
              <span className="flex-1 truncate">{ACTION_LABEL[v.action] ?? v.action}</span>
              <span className="text-neutral-600 flex-shrink-0">
                {new Date(v.created_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const ACTION_LABEL: Record<string, string> = {
  ai_generated: 'AI tạo',
  user_edited: 'Đã chỉnh sửa',
  submitted_for_review: 'Gửi duyệt',
  approved: 'Đã duyệt',
  rejected: 'Bị từ chối',
  superseded: 'Thay thế',
  forked: 'Rẽ nhánh',
};

function StatusIcon({ status }: { status: DraftStatus }) {
  switch (status) {
    case 'approved': return <CheckCircle className="w-3.5 h-3.5 text-green-400" />;
    case 'rejected': return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    case 'under_review': return <Clock className="w-3.5 h-3.5 text-amber-400" />;
    default: return <AlertCircle className="w-3.5 h-3.5 text-neutral-500" />;
  }
}

function ActionButton({
  label,
  onClick,
  disabled,
  variant = 'default',
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'primary' | 'success' | 'danger';
}) {
  const styles: Record<string, string> = {
    default: 'bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10',
    primary: 'bg-brand-primary/20 border-brand-primary/30 text-brand-primary hover:bg-brand-primary/30',
    success: 'bg-green-500/20 border-green-500/30 text-green-400 hover:bg-green-500/30',
    danger: 'bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-2.5 py-1 rounded-md text-xs border transition-colors disabled:opacity-40 ${styles[variant]}`}
    >
      {label}
    </button>
  );
}
