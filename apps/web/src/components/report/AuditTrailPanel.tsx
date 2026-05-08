'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, GitBranch, User, CheckCircle, XCircle, Clock, Zap, Pencil } from 'lucide-react';
import type { ReportVersion } from '@/lib/api/sessions';
import { getVersionHistory } from '@/lib/api/sessions';

interface Props {
  draftId: string;
  currentVersion: number;
}

const ACTION_ICON: Record<string, React.ReactNode> = {
  ai_generated: <Zap className="w-3.5 h-3.5 text-brand-primary" />,
  user_edited: <Pencil className="w-3.5 h-3.5 text-blue-400" />,
  submitted_for_review: <Clock className="w-3.5 h-3.5 text-amber-400" />,
  approved: <CheckCircle className="w-3.5 h-3.5 text-green-400" />,
  rejected: <XCircle className="w-3.5 h-3.5 text-red-400" />,
  superseded: <GitBranch className="w-3.5 h-3.5 text-neutral-500" />,
  forked: <GitBranch className="w-3.5 h-3.5 text-purple-400" />,
};

const ACTION_LABEL: Record<string, string> = {
  ai_generated: 'AI tạo báo cáo',
  user_edited: 'Chỉnh sửa thủ công',
  submitted_for_review: 'Gửi duyệt',
  approved: 'Phê duyệt',
  rejected: 'Từ chối',
  superseded: 'Đã thay thế',
  forked: 'Rẽ nhánh',
};

export function AuditTrailPanel({ draftId, currentVersion }: Props) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<ReportVersion[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { versions: list } = await getVersionHistory(draftId);
      setVersions(list);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [draftId]);

  useEffect(() => {
    if (open && versions.length === 0) load();
  }, [open, load, versions.length]);

  return (
    <div className="border-t border-white/[0.06]">
      {/* Toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          Lịch sử phiên bản
          <span className="px-1.5 py-0.5 rounded-full bg-white/5 text-neutral-600">
            v{currentVersion}
          </span>
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {/* Timeline */}
      {open && (
        <div className="px-4 pb-4">
          {loading && (
            <div className="text-xs text-neutral-600 py-2">Đang tải...</div>
          )}
          {!loading && versions.length === 0 && (
            <div className="text-xs text-neutral-600 py-2">Chưa có lịch sử</div>
          )}
          {versions.length > 0 && (
            <ol className="relative border-l border-white/[0.08] ml-2 space-y-0">
              {versions.map((v, i) => (
                <TimelineItem
                  key={v.id}
                  version={v}
                  isCurrent={v.version === currentVersion}
                  isLast={i === versions.length - 1}
                />
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

function TimelineItem({
  version,
  isCurrent,
  isLast,
}: {
  version: ReportVersion;
  isCurrent: boolean;
  isLast: boolean;
}) {
  const icon = ACTION_ICON[version.action] ?? <Clock className="w-3.5 h-3.5 text-neutral-500" />;
  const label = ACTION_LABEL[version.action] ?? version.action;

  return (
    <li className="ml-4 py-2.5">
      {/* Dot */}
      <span className={`
        absolute -left-[9px] flex items-center justify-center w-4 h-4 rounded-full
        ${isCurrent ? 'bg-brand-primary/20 ring-1 ring-brand-primary/40' : 'bg-neutral-800'}
      `}>
        <span className={`w-1.5 h-1.5 rounded-full ${isCurrent ? 'bg-brand-primary' : 'bg-neutral-600'}`} />
      </span>

      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {icon}
            <span className={`text-xs font-medium ${isCurrent ? 'text-white' : 'text-neutral-300'}`}>
              {label}
            </span>
            <span className="text-[10px] text-neutral-700 font-mono">v{version.version}</span>
          </div>

          {version.action_note && (
            <p className="mt-0.5 text-[11px] text-neutral-500 line-clamp-2">{version.action_note}</p>
          )}

          {version.model_id && (
            <span className="mt-0.5 inline-block text-[10px] text-neutral-700">
              Model: {version.model_id}
            </span>
          )}
        </div>

        <time className="text-[10px] text-neutral-700 flex-shrink-0 mt-0.5">
          {new Date(version.created_at).toLocaleString('vi-VN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </time>
      </div>
    </li>
  );
}
