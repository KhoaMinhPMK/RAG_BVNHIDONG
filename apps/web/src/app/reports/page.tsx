'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ClipboardList, CheckCircle, Clock, AlertTriangle, RefreshCw, ChevronRight, Calendar, User } from 'lucide-react';
import { PageTransition } from '@/components/ui/page-transition';
import { listDrafts, type DraftListItem } from '@/lib/api/client';

type DraftStatus = DraftListItem['status'];

const STATUS_CONFIG: Record<DraftStatus, { label: string; color: string; dot: string }> = {
  draft:          { label: 'Nháp',        color: 'text-text-secondary',     dot: 'bg-text-tertiary' },
  under_review:   { label: 'Chờ duyệt',   color: 'text-semantic-warning',   dot: 'bg-semantic-warning animate-breathe' },
  edited:         { label: 'Đã chỉnh',    color: 'text-blue-400',           dot: 'bg-blue-400' },
  approved:       { label: 'Đã duyệt',    color: 'text-semantic-success',   dot: 'bg-semantic-success' },
  rejected:       { label: 'Từ chối',     color: 'text-semantic-error',     dot: 'bg-semantic-error' },
  archived:       { label: 'Lưu trữ',     color: 'text-text-tertiary',      dot: 'bg-text-tertiary' },
};

type FilterKey = 'all' | DraftStatus;

export default function ReportsPage() {
  const [drafts, setDrafts] = useState<DraftListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  const load = useCallback(async (status?: string) => {
    setIsLoading(true);
    try {
      const result = await listDrafts({ status, limit: 100 });
      setDrafts(result.drafts ?? []);
      setTotal(result.total ?? 0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(activeFilter === 'all' ? undefined : activeFilter);
  }, [activeFilter, load]);

  const counts = drafts.reduce(
    (acc, d) => { acc[d.status] = (acc[d.status] ?? 0) + 1; return acc; },
    {} as Record<string, number>
  );

  const filters: { key: FilterKey; label: string }[] = [
    { key: 'all',          label: 'Tất cả' },
    { key: 'draft',        label: 'Nháp' },
    { key: 'under_review', label: 'Chờ duyệt' },
    { key: 'approved',     label: 'Đã duyệt' },
    { key: 'rejected',     label: 'Từ chối' },
  ];

  return (
    <PageTransition>
      <div className="flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-text-primary">Báo cáo đã lưu</h1>
            <p className="text-xs text-text-tertiary mt-0.5">{total} báo cáo · CAE draft reports</p>
          </div>
          <button
            onClick={() => load(activeFilter === 'all' ? undefined : activeFilter)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-border text-xs text-text-secondary hover:bg-background-secondary transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Làm mới
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Tổng', value: total, icon: ClipboardList },
            { label: 'Chờ duyệt', value: counts['under_review'] ?? 0, icon: AlertTriangle },
            { label: 'Đã duyệt',  value: counts['approved'] ?? 0,     icon: CheckCircle },
            { label: 'Nháp',      value: counts['draft'] ?? 0,        icon: Clock },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="border border-border rounded-sm bg-surface px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="w-3.5 h-3.5 text-text-tertiary" />
                  <span className="text-[10px] text-text-tertiary font-medium">{s.label}</span>
                </div>
                <p className="text-xl font-bold text-text-primary">{s.value}</p>
              </div>
            );
          })}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1">
          {filters.map((f) => {
            const count = f.key === 'all' ? total : (counts[f.key] ?? 0);
            return (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium transition-colors ${
                  activeFilter === f.key
                    ? 'bg-brand-light text-brand-primary'
                    : 'text-text-secondary hover:bg-background-secondary hover:text-text-primary'
                }`}
              >
                {f.label}
                <span className={`text-[10px] font-mono px-1 rounded-sm ${
                  activeFilter === f.key
                    ? 'bg-brand-primary text-white'
                    : 'bg-background-tertiary border border-border text-text-tertiary'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div className="border border-border rounded-sm bg-surface">
          {/* Header */}
          <div className="grid grid-cols-[200px_1fr_140px_120px_120px_32px] gap-3 px-4 py-2 border-b border-border bg-background-secondary">
            {['Draft ID', 'Episode', 'Trạng thái', 'Tạo lúc', 'Cập nhật', ''].map((h) => (
              <span key={h} className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider truncate">
                {h}
              </span>
            ))}
          </div>

          {/* Rows */}
          <div className="divide-y divide-border">
            {isLoading ? (
              <div className="py-12 flex items-center justify-center gap-2 text-text-tertiary">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-xs">Đang tải...</span>
              </div>
            ) : drafts.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3">
                <ClipboardList className="w-8 h-8 text-text-tertiary" />
                <p className="text-sm text-text-secondary">Chưa có báo cáo nào</p>
                <p className="text-xs text-text-tertiary">Báo cáo sẽ xuất hiện ở đây khi CAE sinh draft thành công</p>
              </div>
            ) : (
              drafts.map((d) => {
                const cfg = STATUS_CONFIG[d.status];
                return (
                  <Link
                    key={d.draft_id}
                    href={`/cases/${d.episode_id}?step=draft`}
                    className="grid grid-cols-[200px_1fr_140px_120px_120px_32px] gap-3 px-4 py-3 items-center hover:bg-background-secondary transition-colors group border-l-2 border-transparent hover:border-brand-primary/40"
                  >
                    {/* Draft ID */}
                    <div className="min-w-0">
                      <p className="text-xs font-mono text-text-primary truncate group-hover:text-brand-primary transition-colors">
                        {d.draft_id.slice(0, 8)}…
                      </p>
                      <p className="text-[10px] text-text-tertiary mt-0.5 truncate">
                        {d.model_version ?? '—'}
                      </p>
                    </div>

                    {/* Episode ID */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <User className="w-3 h-3 text-text-tertiary shrink-0" />
                      <span className="text-xs text-text-secondary font-mono truncate">
                        {d.episode_id}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                      <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                    </div>

                    {/* Created at */}
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-text-tertiary shrink-0" />
                      <span className="text-xs text-text-secondary">
                        {new Date(d.created_at).toLocaleDateString('vi-VN', {
                          day: '2-digit', month: '2-digit', year: '2-digit',
                        })}
                      </span>
                    </div>

                    {/* Updated at */}
                    <span className="text-xs text-text-tertiary">
                      {new Date(d.updated_at).toLocaleTimeString('vi-VN', {
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>

                    {/* Arrow */}
                    <ChevronRight className="w-3.5 h-3.5 text-text-tertiary group-hover:text-brand-primary transition-colors" />
                  </Link>
                );
              })
            )}
          </div>
        </div>

      </div>
    </PageTransition>
  );
}
