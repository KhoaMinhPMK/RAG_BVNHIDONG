'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { Plus, Clock, CheckCircle, AlertTriangle, Circle, ChevronRight, User, Calendar, Loader2, RefreshCw } from 'lucide-react';
import { PageTransition } from '@/components/ui/page-transition';
import { EpisodeListSkeleton } from '@/components/ui/loading-skeleton';
import { NetworkError } from '@/components/ui/error-boundary';
import { getEpisodes, type Episode as ApiEpisode, type EpisodeStatus } from '@/lib/api/client';
import { motion } from 'framer-motion';

type CaseStatus = EpisodeStatus;

interface Episode {
  id: string;
  patientRef: string;
  age: string;
  date: string;
  findings: string[];
  status: CaseStatus;
  updatedAt: string;
}

// Transform API episode to UI episode
function transformEpisode(apiEp: ApiEpisode): Episode {
  return {
    id: apiEp.episode_id || apiEp.id,
    patientRef: apiEp.patient_ref || 'Chưa có thông tin',
    age: apiEp.age && apiEp.gender ? `${apiEp.age} · ${apiEp.gender}` : '—',
    date: apiEp.admission_date ? new Date(apiEp.admission_date).toLocaleDateString('vi-VN') : '—',
    findings: apiEp.findings || [],
    status: apiEp.status,
    updatedAt: new Date(apiEp.updated_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
  };
}

const statusConfig: Record<CaseStatus, { label: string; color: string; dot: string; step: string; spinning?: boolean }> = {
  pending_detection: { label: 'Đang phân tích ảnh...', color: 'text-text-secondary',    dot: 'bg-text-tertiary animate-breathe',        step: '1/3', spinning: true },
  pending_explain:   { label: 'Chờ giải thích',         color: 'text-semantic-warning',  dot: 'bg-semantic-warning animate-breathe',     step: '2/3' },
  pending_draft:     { label: 'Chờ sinh báo cáo',       color: 'text-brand-primary',     dot: 'bg-brand-primary animate-breathe',        step: '3/3' },
  pending_approval:  { label: 'Chờ BS duyệt',           color: 'text-semantic-warning',  dot: 'bg-semantic-warning animate-breathe',     step: '3/3' },
  completed:         { label: 'Hoàn thành',              color: 'text-semantic-success',  dot: 'bg-semantic-success',                     step: '✓' },
};

function WorklistContent() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [countdown, setCountdown] = useState(30);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'processing' | 'completed'>('all');
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch episodes from API
  const fetchEpisodes = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await getEpisodes({ limit: 50 });

      if (response.success && response.episodes) {
        const transformed = response.episodes.map(transformEpisode);
        setEpisodes(transformed);
        setLastRefresh(new Date());
      } else {
        setError(response.error?.message || 'Không thể tải danh sách ca');
      }
    } catch (err) {
      setError('Lỗi kết nối đến máy chủ');
      console.error('Failed to fetch episodes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchEpisodes();
  }, []);

  // Auto-refresh countdown
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          fetchEpisodes();
          return 30;
        }
        return c - 1;
      });
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  const hasProcessing = episodes.some(e => e.status === 'pending_detection');

  const filteredEpisodes = activeFilter === 'completed'
    ? episodes.filter(e => e.status === 'completed')
    : activeFilter === 'processing'
    ? episodes.filter(e => e.status !== 'completed')
    : episodes;

  return (
    <PageTransition>
      <div className="flex flex-col gap-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-text-primary">Danh sách ca X-quang</h1>
          <p className="text-xs text-text-tertiary mt-0.5">
            01/05/2024 · {episodes.length} ca · Bác sỹ A
            <span className="ml-3 inline-flex items-center gap-1">
              {hasProcessing
                ? <><Loader2 className="w-3 h-3 animate-spin inline" /> Polling ({countdown}s)</>
                : <><RefreshCw className="w-3 h-3 inline" /> Refresh trong {countdown}s</>
              }
            </span>
          </p>
        </div>
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Link
            href="/cases/new"
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-primary text-white text-xs font-semibold rounded-sm hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            Tạo ca mới
          </Link>
        </motion.div>
      </div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="grid grid-cols-4 gap-3"
      >
        {[
          { label: 'Tổng ca hôm nay', value: String(episodes.length), icon: Circle },
          { label: 'Đang xử lý', value: String(episodes.filter(e => e.status !== 'completed').length), icon: Clock },
          { label: 'Chờ duyệt', value: String(episodes.filter(e => e.status === 'pending_approval').length), icon: AlertTriangle },
          { label: 'Hoàn thành', value: String(episodes.filter(e => e.status === 'completed').length), icon: CheckCircle },
        ].map((s, idx) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.1 }}
              whileHover={{ scale: 1.02, y: -2 }}
              className="border border-border rounded-sm bg-surface px-3 py-2.5 cursor-pointer"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="w-3.5 h-3.5 text-text-tertiary" />
                <span className="text-[10px] text-text-tertiary font-medium">{s.label}</span>
              </div>
              <p className="text-xl font-bold text-text-primary">{s.value}</p>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1">
        {([
          { label: 'Tất cả',      count: episodes.length,                                          key: 'all' as const },
          { label: 'Đang xử lý', count: episodes.filter(e => e.status !== 'completed').length,    key: 'processing' as const },
          { label: 'Hoàn thành', count: episodes.filter(e => e.status === 'completed').length,    key: 'completed' as const },
        ]).map((f) => (
          <button
            key={f.label}
            onClick={() => setActiveFilter(f.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium transition-all duration-150 hover:scale-105 ${
              activeFilter === f.key
                ? 'bg-brand-light text-brand-primary'
                : 'text-text-secondary hover:bg-background-secondary hover:text-text-primary'
            }`}
          >
            {f.label}
            <motion.span
              initial={false}
              animate={{ scale: 1 }}
              whileHover={{ scale: 1.1 }}
              className={`text-[10px] font-mono px-1 rounded-sm inline-block ${activeFilter === f.key ? 'bg-brand-primary text-white' : 'bg-background-tertiary border border-border text-text-tertiary'}`}
            >
              {f.count}
            </motion.span>
          </button>
        ))}
      </div>

      {/* Episodes table */}
      <div className="border border-border rounded-sm bg-surface">
        {/* Table header */}
        <div className="grid grid-cols-[180px_120px_80px_1fr_140px_80px_40px] gap-3 px-4 py-2 border-b border-border bg-background-secondary">
          {['Mã ca / Bệnh nhân', 'Ngày chụp', 'Bệnh nhân', 'Phát hiện', 'Trạng thái', 'Cập nhật', ''].map((h) => (
            <span key={h} className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider truncate">
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        <div className="divide-y divide-border">
          {isLoading ? (
            <div className="p-4">
              <EpisodeListSkeleton count={5} />
            </div>
          ) : (
            filteredEpisodes.map((ep, idx) => {
            const cfg = statusConfig[ep.status];
            return (
              <Link
                key={ep.id}
                href={`/cases/${ep.id}`}
                className="grid grid-cols-[180px_120px_80px_1fr_140px_80px_40px] gap-3 px-4 py-3 items-center hover:bg-background-secondary transition-all duration-200 group animate-row-in hover:translate-x-0.5 border-l-2 border-transparent hover:border-brand-primary/40"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                {/* ID */}
                <div>
                  <p className="text-xs font-semibold text-text-primary group-hover:text-brand-primary transition-colors font-mono">
                    {ep.id}
                  </p>
                  <p className="text-[10px] text-text-tertiary mt-0.5">{ep.patientRef}</p>
                </div>

                {/* Date */}
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-text-tertiary shrink-0" />
                  <span className="text-xs text-text-secondary">{ep.date}</span>
                </div>

                {/* Age */}
                <div className="flex items-center gap-1.5">
                  <User className="w-3 h-3 text-text-tertiary shrink-0" />
                  <span className="text-xs text-text-secondary truncate">{ep.age}</span>
                </div>

                {/* Findings */}
                <div className="flex flex-wrap gap-1 min-w-0">
                  {ep.findings.length === 0 ? (
                    <span className="text-[10px] text-text-tertiary italic">Chưa phân tích</span>
                  ) : ep.findings.map((f) => (
                    <span key={f} className="text-[10px] px-1.5 py-0.5 bg-background-tertiary border border-border rounded-sm text-text-secondary truncate">
                      {f}
                    </span>
                  ))}
                </div>

                {/* Status */}
                <div className="flex items-center gap-1.5">
                  {cfg.spinning
                    ? <Loader2 className="w-3 h-3 animate-spin text-text-tertiary shrink-0" />
                    : <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                  }
                  <span className={`text-[10px] font-medium ${cfg.color}`}>{cfg.label}</span>
                  <span className="text-[10px] text-text-tertiary font-mono ml-auto">{cfg.step}</span>
                </div>

                {/* Time */}
                <span className="text-[10px] text-text-tertiary font-mono">{ep.updatedAt}</span>

                {/* Arrow */}
                <ChevronRight className="w-3.5 h-3.5 text-text-tertiary group-hover:text-brand-primary transition-colors" />
              </Link>
            );
          })
          )}
        </div>
      </div>

      {/* Error state */}
      {error && !isLoading && (
        <NetworkError onRetry={fetchEpisodes} />
      )}

      {/* Empty state */}
      {!error && !isLoading && filteredEpisodes.length === 0 && (
        <div className="border border-border rounded-sm bg-surface p-12 text-center">
          <Circle className="w-8 h-8 text-text-tertiary mx-auto mb-3" />
          <p className="text-sm font-medium text-text-secondary">Chưa có ca nào</p>
          <p className="text-xs text-text-tertiary mt-1">Tạo ca mới để bắt đầu</p>
        </div>
      )}

      <p className="text-[10px] text-text-tertiary text-center">
        {error ? 'Lỗi kết nối' : isLoading ? 'Đang tải...' : `${episodes.length} ca · Cập nhật ${lastRefresh.toLocaleTimeString('vi-VN')}`}
      </p>
    </div>
    </PageTransition>
  );
}

export default function WorklistPage() {
  return (
    <Suspense fallback={<EpisodeListSkeleton />}>
      <WorklistContent />
    </Suspense>
  );
}
