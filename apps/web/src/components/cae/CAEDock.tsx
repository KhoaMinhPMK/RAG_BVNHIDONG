/**
 * CAE Dock - Adaptive AI Panel
 *
 * Replaces static CAEPanel with adaptive dock that can collapse/expand based on context.
 * 6 states: collapsed, peek, task, focus, compose, pinned
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Pin, PinOff, ChevronLeft, ChevronRight, Brain, CheckCircle2, Loader2, AlertCircle, Send, MessageSquare, FileText, Zap, ChevronDown, RefreshCw, Database } from 'lucide-react';
import { BlockRenderer, MarkdownContent } from './BlockRenderer';
import { EvidenceRail } from './EvidenceRail';
import { useCAEStream } from '@/hooks/useCAEStream';
import { getLatestAiRun, invalidateAiRunCache } from '@/lib/api/client';
import type { CitationAnchor, RenderableBlock, UIAction } from '@/types/cae-output';

export type DockState = 'collapsed' | 'peek' | 'task' | 'focus' | 'compose' | 'pinned';
export type DockMode = 'brief' | 'chat' | 'patch_review' | 'system_status';

interface CAEDockProps {
  episodeId: string;
  currentStep: 'detection' | 'explain' | 'draft';
  findingIds?: string[];
  contextCitations?: CitationAnchor[];
  onCitationClick?: (citationId: string) => void;
  onCitationHover?: (citationId: string | null) => void;
  onUIAction?: (action: UIAction) => void;
  onCitationsChange?: (citations: CitationAnchor[]) => void;
  onActivityDetected?: () => void;
  /** When true the dock fills its parent container — no width transitions or handle strip */
  fullWidth?: boolean;
}

const STATE_WIDTHS: Record<DockState, string> = {
  collapsed: 'w-14',
  peek: 'w-28',
  task: 'w-96',
  focus: 'w-[480px]',
  compose: 'w-[560px]',
  pinned: 'w-96', // Will use previous state width
};

const AUTO_COLLAPSE_DELAY = 5000; // 5s
const HOVER_EXPAND_DELAY = 500; // 500ms

interface UsageSnapshot {
  reasoning_tokens: number;
  completion_tokens: number;
  model: string;
}

interface DockRunSnapshot {
  id: string;
  mode: DockMode;
  title: string;
  summary: string;
  createdAt: number;
  status: 'done' | 'error';
  blocks: RenderableBlock[];
  content: string;
  citations: CitationAnchor[];
  usage: UsageSnapshot | null;
  error: string | null;
}

type DockStageStatus = 'pending' | 'running' | 'done' | 'error';

interface DockStage {
  key: string;
  label: string;
  description: string;
  status: DockStageStatus;
}

const MODE_LABELS: Record<DockMode, string> = {
  brief: 'Briefing',
  chat: 'Hỏi đáp',
  patch_review: 'Patch',
  system_status: 'Hệ thống',
};

function getRunSummary(blocks: RenderableBlock[], content: string, error: string | null) {
  if (error) {
    return error;
  }

  const summaryBlock = blocks.find((block) => block.type === 'summary');
  if (summaryBlock) {
    return summaryBlock.text;
  }

  const paragraphBlock = blocks.find((block) => block.type === 'paragraph');
  if (paragraphBlock) {
    return paragraphBlock.text;
  }

  return content.trim();
}

function getToolStatus(
  toolCalls: Array<{ name: string; status: 'running' | 'done' | 'error' }>,
  names: string[]
): DockStageStatus | null {
  const matches = toolCalls.filter((tool) => names.includes(tool.name));

  if (matches.some((tool) => tool.status === 'error')) {
    return 'error';
  }

  if (matches.some((tool) => tool.status === 'running')) {
    return 'running';
  }

  if (matches.some((tool) => tool.status === 'done')) {
    return 'done';
  }

  return null;
}

function getActionStageLabel(mode: DockMode) {
  switch (mode) {
    case 'patch_review':
      return {
        label: 'Chuẩn bị patch',
        description: 'Ghép field, confidence và hành động sửa nháp.',
      };
    case 'brief':
      return {
        label: 'Mở evidence rail',
        description: 'Chuẩn bị citation và action điều hướng theo finding.',
      };
    case 'system_status':
      return {
        label: 'Tổng hợp trạng thái',
        description: 'Chuẩn bị chỉ dấu vận hành và cảnh báo hệ thống.',
      };
    case 'chat':
    default:
      return {
        label: 'Chuẩn bị tác vụ',
        description: 'Mở citation, focus finding và các hành động tiếp theo.',
      };
  }
}

function buildDockStages(params: {
  mode: DockMode;
  isStreaming: boolean;
  error: string | null;
  toolCalls: Array<{ name: string; status: 'running' | 'done' | 'error' }>;
  blocks: RenderableBlock[];
  citations: CitationAnchor[];
  actions: UIAction[];
  content: string;
  thinking: string;
}): DockStage[] {
  const { mode, isStreaming, error, toolCalls, blocks, citations, actions, content, thinking } = params;
  const hasOutput = blocks.length > 0 || content.trim().length > 0;
  const hasReasoning = thinking.trim().length > 0;
  const hasPatchBlocks = blocks.some((block) => block.type === 'field_patch' || block.type === 'patch_group');
  const hasActionPayload = citations.length > 0 || actions.length > 0 || hasPatchBlocks;
  const streamSettled = !isStreaming && (hasOutput || Boolean(error));

  const contextStatus = getToolStatus(toolCalls, ['get_patient_context', 'get_detection_results'])
    ?? (toolCalls.length > 0 || hasReasoning || hasOutput || streamSettled
      ? 'done'
      : isStreaming
        ? 'running'
        : 'pending');

  const evidenceStatus = getToolStatus(toolCalls, ['search_knowledge_base'])
    ?? (citations.length > 0
      ? 'done'
      : isStreaming && (contextStatus === 'done' || hasReasoning || hasOutput)
        ? 'running'
        : streamSettled
          ? 'done'
          : 'pending');

  const synthesisStatus = hasOutput
    ? 'done'
    : error
      ? 'error'
      : isStreaming && (contextStatus !== 'pending' || evidenceStatus !== 'pending' || hasReasoning)
        ? 'running'
        : 'pending';

  const explicitActionStatus = getToolStatus(toolCalls, ['generate_draft', 'save_draft_report']);
  const actionStatus = explicitActionStatus
    ?? (hasActionPayload
      ? 'done'
      : error
        ? 'error'
        : isStreaming && (hasOutput || synthesisStatus === 'done')
          ? 'running'
          : streamSettled
            ? 'done'
            : 'pending');

  const actionStage = getActionStageLabel(mode);

  return [
    {
      key: 'context',
      label: 'Thu thập ca bệnh',
      description: 'Đọc hồ sơ, finding AI và dữ kiện lâm sàng đầu vào.',
      status: contextStatus,
    },
    {
      key: 'evidence',
      label: 'Truy xuất evidence',
      description: 'Tìm guideline, trích đoạn và độ tin cậy liên quan.',
      status: evidenceStatus,
    },
    {
      key: 'synthesis',
      label: 'Tổng hợp kết quả',
      description: 'Ghép narrative, bảng so sánh và kết luận có kiểm soát.',
      status: synthesisStatus,
    },
    {
      key: 'actions',
      label: actionStage.label,
      description: actionStage.description,
      status: actionStatus,
    },
  ];
}

function classifyDockFailure(error: string | null) {
  if (!error) {
    return null;
  }

  const normalized = error.toLowerCase();

  if (normalized.includes('timeout') || normalized.includes('timed out') || normalized.includes('abort')) {
    return {
      title: 'Provider phản hồi chậm',
      detail: 'Luồng CAE đã bị timeout hoặc bị ngắt trước khi hoàn tất. Có thể thử lại khi provider ổn định hơn.',
    };
  }

  if (normalized.includes('insufficient_evidence') || normalized.includes('không đủ bằng chứng') || normalized.includes('evidence')) {
    return {
      title: 'Bằng chứng chưa đủ mạnh',
      detail: 'CAE chưa gom được evidence đủ chắc để kết luận. Luồng này nên được xem như từ chối an toàn, không phải lỗi hệ thống thuần túy.',
    };
  }

  if (normalized.includes('validation') || normalized.includes('draft') || normalized.includes('patch')) {
    return {
      title: 'Patch bị chặn bởi guardrail',
      detail: 'Luồng sinh draft đã tạo được nội dung nhưng không qua được bước kiểm tra schema hoặc confidence.',
    };
  }

  if (normalized.includes('http 5') || normalized.includes('route') || normalized.includes('server')) {
    return {
      title: 'Route hoặc máy chủ lỗi',
      detail: 'Có lỗi phía backend hoặc route SSE trong lúc xử lý yêu cầu hiện tại.',
    };
  }

  return {
    title: 'Luồng CAE lỗi kỹ thuật',
    detail: error,
  };
}

function getStageTone(status: DockStageStatus) {
  switch (status) {
    case 'done':
      return {
        dot: 'bg-semantic-success',
        label: 'xong',
        labelClass: 'text-semantic-success',
        cardClass: 'border-semantic-success/20 bg-semantic-success/5',
      };
    case 'running':
      return {
        dot: 'bg-brand-primary animate-pulse',
        label: 'đang chạy',
        labelClass: 'text-brand-primary',
        cardClass: 'border-brand-primary/25 bg-brand-light/10',
      };
    case 'error':
      return {
        dot: 'bg-semantic-error',
        label: 'lỗi',
        labelClass: 'text-semantic-error',
        cardClass: 'border-semantic-error/25 bg-semantic-error/5',
      };
    case 'pending':
    default:
      return {
        dot: 'bg-text-tertiary/40',
        label: 'chờ',
        labelClass: 'text-text-tertiary',
        cardClass: 'border-border bg-background-secondary',
      };
  }
}

export function CAEDock({
  episodeId,
  currentStep,
  findingIds,
  contextCitations = [],
  onCitationClick,
  onCitationHover,
  onUIAction,
  onCitationsChange,
  onActivityDetected,
  fullWidth = false,
}: CAEDockProps) {
  const [state, setState] = useState<DockState>('collapsed');
  const [mode, setMode] = useState<DockMode>('brief');
  const [isPinned, setIsPinned] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [input, setInput] = useState('');
  const [activeCitationId, setActiveCitationId] = useState<string | null>(null);
  const [showTrace, setShowTrace] = useState(false);
  const [runSnapshots, setRunSnapshots] = useState<DockRunSnapshot[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [expandedPastRunId, setExpandedPastRunId] = useState<string | null>(null);

  const {
    isStreaming,
    thinking,
    toolCalls,
    content,
    blocks,
    citations,
    actions,
    error,
    usage,
    startBrief,
    startChat,
    abort,
    reset,
  } = useCAEStream();

  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const collapseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processedActionCountRef = useRef(0);
  const previousStateRef = useRef<DockState>('task');
  const hasLoadedBriefRef = useRef(false);
  const activeRunRef = useRef<{ id: string; mode: DockMode; title: string; createdAt: number } | null>(null);
  const recordedRunIdRef = useRef<string | null>(null);

  const selectedSnapshot = selectedRunId
    ? runSnapshots.find((run) => run.id === selectedRunId) ?? null
    : null;
  const displayBlocks = selectedSnapshot?.blocks ?? blocks;
  const displayContent = selectedSnapshot?.content ?? content;
  const displayCitations = selectedSnapshot?.citations?.length
    ? selectedSnapshot.citations
    : citations.length > 0
      ? citations
      : contextCitations;
  const displayError = selectedSnapshot?.error ?? error;
  const displayUsage = selectedSnapshot?.usage ?? usage;
  const liveStages = buildDockStages({
    mode,
    isStreaming,
    error,
    toolCalls,
    blocks,
    citations,
    actions,
    content,
    thinking,
  });
  const liveFailure = classifyDockFailure(error);

  const beginRun = useCallback((nextMode: DockMode, title: string) => {
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    activeRunRef.current = {
      id: runId,
      mode: nextMode,
      title: title.trim(),
      createdAt: Date.now(),
    };
    recordedRunIdRef.current = null;
    setSelectedRunId(runId);
  }, []);

  useEffect(() => {
    const stepModeMap: Record<CAEDockProps['currentStep'], DockMode> = {
      detection: 'brief',
      explain: 'chat',
      draft: 'patch_review',
    };

    setMode(stepModeMap[currentStep]);
  }, [currentStep]);

  // ── DB restore helpers ────────────────────────────────────────────────────
  const [isRestoringFromDb, setIsRestoringFromDb] = useState(false);

  /** Convert a saved AiRunRow back into a DockRunSnapshot for UI display */
  const runRowToSnapshot = useCallback((row: Awaited<ReturnType<typeof getLatestAiRun>>): DockRunSnapshot | null => {
    if (!row) return null;
    return {
      id:         row.run_id,
      mode:       (row.run_type === 'brief' ? 'brief' : row.run_type === 'chat' ? 'chat' : 'brief') as DockMode,
      title:      row.run_type === 'brief' ? 'Tóm tắt ca hiện tại' : row.run_type,
      summary:    row.raw_content.slice(0, 180),
      createdAt:  new Date(row.created_at).getTime(),
      status:     row.error_msg ? 'error' : 'done',
      blocks:     row.blocks as unknown as RenderableBlock[],
      content:    row.raw_content,
      citations:  row.citations as unknown as CitationAnchor[],
      usage:      null,
      error:      row.error_msg,
    };
  }, []);

  useEffect(() => {
    hasLoadedBriefRef.current = false;
    processedActionCountRef.current = 0;
    setActiveCitationId(null);
    setShowTrace(false);
    setSelectedRunId(null);
    activeRunRef.current = null;
    recordedRunIdRef.current = null;
    setRunSnapshots([]);

    // Try to restore from DB first (avoids re-running LLM on tab switch)
    let cancelled = false;
    setIsRestoringFromDb(true);
    getLatestAiRun(episodeId, 'brief', 480).then((row) => {
      if (cancelled) return;
      setIsRestoringFromDb(false);
      if (row) {
        const snap = runRowToSnapshot(row);
        if (snap) {
          setRunSnapshots([snap]);
          setSelectedRunId(snap.id);
          hasLoadedBriefRef.current = true;
          return;
        }
      }
      // No recent run in DB — will trigger the auto-load effect below
    }).catch(() => {
      if (!cancelled) setIsRestoringFromDb(false);
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeId]);

  // Auto-load brief — skipped when DB restore found a recent run
  useEffect(() => {
    if (isRestoringFromDb) return; // wait for DB check to complete
    if (episodeId && !hasLoadedBriefRef.current) {
      hasLoadedBriefRef.current = true;
      beginRun('brief', 'Tóm tắt ca hiện tại');
      startBrief(episodeId, { findingIds });
    }
    return () => {
      abort();
      reset();
      hasLoadedBriefRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeId, isRestoringFromDb]);

  useEffect(() => {
    const activeRun = activeRunRef.current;

    if (!activeRun || isStreaming || recordedRunIdRef.current === activeRun.id) {
      return;
    }

    // Don't save a snapshot from a stream that was aborted without a proper
    // done/error event — usage is null and error is null in that case.
    // This prevents React Strict Mode's abort-and-remount from leaving a
    // partial "ghost" snapshot (e.g. content = "Tôi") in the thread.
    if (!usage && !error) {
      return;
    }

    if (blocks.length === 0 && !content.trim() && !error) {
      return;
    }

    const snapshot: DockRunSnapshot = {
      id: activeRun.id,
      mode: activeRun.mode,
      title: activeRun.title,
      summary: getRunSummary(blocks, content, error).slice(0, 180),
      createdAt: activeRun.createdAt,
      status: error ? 'error' : 'done',
      blocks: [...blocks],
      content,
      citations: [...citations],
      usage,
      error,
    };

    const next = [snapshot, ...runSnapshots.filter((run) => run.id !== snapshot.id)].slice(0, 6);
    setRunSnapshots(next);
    setSelectedRunId(snapshot.id);
    recordedRunIdRef.current = snapshot.id;

    // Invalidate DB cache so next fetch gets the freshly completed run
    if (snapshot.mode === 'brief' && snapshot.status === 'done') {
      invalidateAiRunCache(episodeId, 'brief');
    }
  }, [blocks, citations, content, error, isStreaming, usage, episodeId, runSnapshots]);

  useEffect(() => {
    if (!onCitationsChange) return;
    // Skip when displayCitations is still the contextCitations reference —
    // calling onCitationsChange in that case would set the parent state to the
    // same array it just passed in, creating an infinite re-render loop.
    if (displayCitations === contextCitations) return;
    onCitationsChange(displayCitations);
  }, [displayCitations, onCitationsChange, contextCitations]);

  useEffect(() => {
    if (actions.length <= processedActionCountRef.current) {
      return;
    }

    const pendingActions = actions.slice(processedActionCountRef.current);
    processedActionCountRef.current = actions.length;

    pendingActions.forEach((action) => {
      if (!isPinned) {
        if (action.type === 'dock_state') {
          setState(action.state);
        }

        if (action.type === 'open_evidence') {
          setState('focus');
          setActiveCitationId(action.citationId);
        }

        if (action.type === 'highlight_field') {
          setState('compose');
        }

        if (action.type === 'focus_finding') {
          setState('focus');
        }
      }

      onUIAction?.(action);
    });
  }, [actions, isPinned, onUIAction]);

  // Extract summary from blocks
  const summary = displayBlocks.find(b => b.type === 'summary')?.text ||
                  displayBlocks.find(b => b.type === 'paragraph')?.text.slice(0, 100) ||
                  displayContent.slice(0, 100) ||
                  '';

  // Auto-expand to focus state when citations arrive
  useEffect(() => {
    if (fullWidth) return;
    if ((citations.length > 0 || contextCitations.length > 0) && state !== 'focus' && !isPinned) {
      setState('focus');
    }
  }, [citations.length, contextCitations.length, state, isPinned, fullWidth]);

  // Auto-collapse after inactivity
  useEffect(() => {
    if (fullWidth) return;
    if (isPinned || state === 'collapsed' || isStreaming) return;

    collapseTimeoutRef.current = setTimeout(() => {
      if (!isHovering && !isPinned) {
        previousStateRef.current = state;
        setState('peek');
      }
    }, AUTO_COLLAPSE_DELAY);

    return () => {
      if (collapseTimeoutRef.current) {
        clearTimeout(collapseTimeoutRef.current);
      }
    };
  }, [state, isPinned, isHovering, isStreaming]);

  // Hover to expand
  const handleMouseEnter = useCallback(() => {
    setIsHovering(true);

    if (!fullWidth && (state === 'collapsed' || state === 'peek')) {
      hoverTimeoutRef.current = setTimeout(() => {
        if (!isPinned) {
          setState('task');
        }
      }, HOVER_EXPAND_DELAY);
    }
  }, [state, isPinned, fullWidth]);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);

    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
  }, []);

  // Toggle pin
  const togglePin = useCallback(() => {
    setIsPinned(prev => !prev);
  }, []);

  // Manual state control
  const expandDock = useCallback(() => {
    if (state === 'collapsed') {
      setState('peek');
    } else if (state === 'peek') {
      setState('task');
    }
  }, [state]);

  const collapseDock = useCallback(() => {
    if (!isPinned) {
      if (state === 'task' || state === 'focus' || state === 'compose') {
        setState('peek');
      } else if (state === 'peek') {
        setState('collapsed');
      }
    }
  }, [state, isPinned]);

  // Get current width class
  const widthClass = isPinned && previousStateRef.current !== 'collapsed'
    ? STATE_WIDTHS[previousStateRef.current]
    : STATE_WIDTHS[state];

  // Render dock handle
  const isExpanded = state !== 'collapsed' && state !== 'peek';
  const renderHandle = () => (
    <div className="flex flex-col items-center gap-2 py-3 px-2 border-r border-border bg-background-secondary">
      {/* Activity indicator dot */}
      <div className="relative mb-0.5">
        {isStreaming && (
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-brand-primary animate-breathe z-10" />
        )}
        <button
          onClick={isExpanded ? collapseDock : expandDock}
          className="p-1.5 rounded hover:bg-background transition-colors"
          aria-label={isExpanded ? 'Collapse dock' : 'Expand dock'}
        >
          {isExpanded
            ? <ChevronRight className="w-4 h-4 text-text-secondary" />
            : <ChevronLeft  className="w-4 h-4 text-text-secondary" />
          }
        </button>
      </div>

      {state !== 'collapsed' && (
        <>
          <div className="flex-1 flex items-center">
            <div
              className="w-px h-12 rounded-full"
              style={{
                background: isStreaming
                  ? 'linear-gradient(to bottom, transparent, hsl(177 75% 34% / 0.4), transparent)'
                  : 'var(--color-border)',
              }}
            />
          </div>

          <button
            onClick={togglePin}
            className={`p-1.5 rounded transition-colors ${
              isPinned
                ? 'bg-brand-light text-brand-primary'
                : 'hover:bg-background text-text-tertiary'
            }`}
            aria-label={isPinned ? 'Unpin dock' : 'Pin dock'}
          >
            {isPinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
          </button>
        </>
      )}
    </div>
  );

  // Render mode header
  const renderModeHeader = () => {
    if (!fullWidth && state === 'collapsed') return null;

    const modeLabels: Record<DockMode, string> = {
      brief: 'CAE Briefing',
      chat: 'Hỏi CAE',
      patch_review: 'Duyệt Patch',
      system_status: 'Trạng thái hệ thống',
    };

    return (
      <div className="px-3 py-2 border-b border-border bg-background-secondary/60 flex items-center justify-between">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
          {modeLabels[mode]}
        </p>
        {isStreaming && (
          <span className="flex items-center gap-1 text-[10px] text-brand-primary font-medium">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            live
          </span>
        )}
      </div>
    );
  };

  // Render summary strip
  const renderSummary = () => {
    if (!fullWidth && state === 'collapsed') return null;
    if (!summary) return null;

    return (
      <div className="px-3 py-2 border-b border-border">
        <p className="text-xs text-text-primary leading-relaxed line-clamp-2">
          {summary}
        </p>
      </div>
    );
  };

  const renderRunHistory = () => {
    const activeRun = activeRunRef.current;
    const recentRuns = runSnapshots.filter((run) => run.id !== activeRun?.id).slice(0, 4);

    if (!activeRun && recentRuns.length === 0) {
      return null;
    }

    return (
      <div className="space-y-2 border-b border-border pb-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Lượt CAE</p>
          {isStreaming && activeRun && selectedSnapshot && selectedSnapshot.id !== activeRun.id && (
            <button
              onClick={() => setSelectedRunId(activeRun.id)}
              className="text-[10px] text-brand-primary hover:text-brand-primary/80 transition-colors"
            >
              Về lượt hiện tại
            </button>
          )}
        </div>
        <div className="space-y-1.5">
          {activeRun && (
            <button
              onClick={() => setSelectedRunId(activeRun.id)}
              className={`w-full rounded-sm border px-2.5 py-2 text-left transition-colors ${
                selectedRunId === activeRun.id
                  ? 'border-brand-primary bg-brand-light/10'
                  : 'border-border bg-background-secondary hover:border-brand-primary/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold text-text-primary">
                  {MODE_LABELS[activeRun.mode]} {isStreaming ? 'đang chạy' : 'vừa xong'}
                </span>
                <span className="text-[10px] text-text-tertiary font-mono">live</span>
              </div>
              <p className="mt-1 text-xs text-text-primary line-clamp-1">{activeRun.title}</p>
              <p className="mt-1 text-[10px] text-text-tertiary line-clamp-2">
                {isStreaming ? 'CAE đang tiếp tục phân tích và ghép bằng chứng cho lượt này.' : 'Lượt hiện tại đã hoàn tất, chọn để xem bản live mới nhất.'}
              </p>
            </button>
          )}
          {recentRuns.map((run) => (
            <button
              key={run.id}
              onClick={() => setSelectedRunId(run.id)}
              className={`w-full rounded-sm border px-2.5 py-2 text-left transition-colors ${
                selectedSnapshot?.id === run.id
                  ? 'border-brand-primary bg-brand-light/10'
                  : 'border-border bg-background-secondary hover:border-brand-primary/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold text-text-primary">{MODE_LABELS[run.mode]}</span>
                <span className={`text-[10px] font-mono ${run.status === 'error' ? 'text-semantic-error' : 'text-text-tertiary'}`}>
                  {run.status === 'error' ? 'error' : new Date(run.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="mt-1 text-xs text-text-primary line-clamp-1">{run.title}</p>
              <p className="mt-1 text-[10px] text-text-tertiary line-clamp-2">{run.summary || 'Không có tóm tắt cho lượt này.'}</p>
              <div className="mt-2 flex items-center gap-2 text-[10px] text-text-tertiary">
                <span>{run.citations.length} nguồn</span>
                {run.usage && <span>{run.usage.completion_tokens} tokens</span>}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  // Render content based on state
  const renderContent = () => {
    if (!fullWidth && (state === 'collapsed' || state === 'peek')) return null;

    return (
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {renderRunHistory()}

        {(isStreaming || liveFailure) && (
          <div className="rounded-sm border border-border bg-background-secondary/70 p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Tiến trình live</p>
                <p className="text-xs text-text-secondary">
                  {isStreaming ? 'CAE đang đi qua các stage xử lý hiện tại.' : liveFailure?.title}
                </p>
              </div>
              {isStreaming ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-primary shrink-0" />
              ) : liveFailure ? (
                <AlertCircle className="w-3.5 h-3.5 text-semantic-error shrink-0" />
              ) : null}
            </div>

            <div className="space-y-1.5">
              {liveStages.map((stage) => {
                const tone = getStageTone(stage.status);

                return (
                  <div
                    key={stage.key}
                    className={`flex items-start gap-2 rounded-sm border px-2 py-1.5 ${tone.cardClass}`}
                  >
                    <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${tone.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-text-primary">{stage.label}</span>
                        <span className={`text-[10px] font-semibold uppercase tracking-wider ${tone.labelClass}`}>
                          {tone.label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10px] text-text-tertiary leading-relaxed">{stage.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {liveFailure && (
              <div className="rounded-sm border border-semantic-error/25 bg-semantic-error/5 px-2.5 py-2">
                <p className="text-xs font-medium text-semantic-error">{liveFailure.title}</p>
                <p className="mt-1 text-[10px] text-semantic-error/90 leading-relaxed">{liveFailure.detail}</p>
              </div>
            )}
          </div>
        )}

        {/* Tool calls */}
        {toolCalls.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5">
            {toolCalls.map((tool, index) => (
              <div key={`${tool.name}-${index}`} className="flex items-center gap-1.5 px-2 py-1 rounded-sm border border-border bg-background-secondary text-[10px]">
                <span className="font-semibold text-text-primary shrink-0">{tool.label}</span>
                {tool.status === 'running' && <Loader2 className="w-3 h-3 animate-spin text-brand-primary shrink-0" />}
                {tool.status === 'done' && <CheckCircle2 className="w-3 h-3 text-semantic-success shrink-0" />}
              </div>
            ))}
          </div>
        )}

        {/* Thinking */}
        {thinking && (
          <div className="border border-brand-primary/20 rounded-sm bg-brand-light/10 overflow-hidden">
            <button
              onClick={() => setShowTrace((value) => !value)}
              className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-brand-light/20 transition-colors"
            >
              <Brain className="w-3 h-3 text-brand-primary shrink-0" />
              <span className="text-[10px] font-semibold text-brand-primary uppercase tracking-wider">
                Trace nội bộ
              </span>
              <span className="ml-auto text-[10px] text-brand-primary/80">{showTrace ? 'Ẩn' : 'Hiện'}</span>
            </button>
            {showTrace && (
              <div className="px-2.5 pb-2.5">
                <p className="text-[10px] text-text-secondary leading-relaxed whitespace-pre-wrap font-mono max-h-24 overflow-y-auto">
                  {thinking}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Structured blocks */}
        {displayBlocks.length > 0 ? (
          <BlockRenderer blocks={displayBlocks} onCitationClick={onCitationClick} />
        ) : displayContent && !isStreaming ? (
          <MarkdownContent text={displayContent} onCitationClick={onCitationClick} />
        ) : isStreaming ? (
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>CAE đang phân tích...</span>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-text-tertiary">Chưa có nội dung</p>
          </div>
        )}

        {/* Error */}
        {displayError && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-sm border border-semantic-error/30 bg-semantic-error/5">
            <AlertCircle className="w-3.5 h-3.5 text-semantic-error shrink-0 mt-0.5" />
            <p className="text-xs text-semantic-error">{displayError}</p>
          </div>
        )}

        {/* Usage info */}
        {displayUsage && !isStreaming && (
          <div className="flex items-center gap-3 text-[10px] text-text-tertiary font-mono">
            <span>{displayUsage.model}</span>
            {displayUsage.reasoning_tokens > 0 && <span>{displayUsage.reasoning_tokens} reasoning</span>}
            <span>{displayUsage.completion_tokens} tokens</span>
          </div>
        )}
      </div>
    );
  };

  // Render action zone
  const renderActionZone = () => {
    if (!fullWidth && (state === 'collapsed' || state === 'peek')) return null;

    const handleSend = () => {
      if (!input.trim() || isStreaming) return;

      setMode('chat');
      beginRun('chat', input);
      startChat(episodeId, [{ role: 'user', content: input }], { findingIds });
      setInput('');
      onActivityDetected?.();
    };

    return (
      <div className="border-t border-border p-2 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Hỏi CAE về ca bệnh này..."
          className="flex-1 text-xs border border-border rounded-sm px-2.5 py-1.5 bg-background focus:outline-none focus:border-brand-primary text-text-primary placeholder:text-text-tertiary disabled:opacity-50 transition-colors"
          onFocus={onActivityDetected}
          disabled={isStreaming}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isStreaming}
          className="w-8 h-8 flex items-center justify-center rounded-sm bg-brand-primary text-white disabled:opacity-40 hover:bg-brand-hover transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  // ─── fullWidth-only renders (Conversation Thread pattern) ────────────────

  function humanizeError(raw: string): string {
    const s = raw.toLowerCase();
    if (s.includes('fetch failed') || s.includes('network') || s.includes('econnrefused')) {
      return 'Không thể kết nối tới AI backend. Kiểm tra kết nối mạng và thử lại.';
    }
    if (s.includes('ngắt giữa chừng') || s.includes('disconnected')) {
      return 'Kết nối bị ngắt giữa chừng. Thử lại hoặc kiểm tra backend.';
    }
    if (s.includes('timeout') || s.includes('timed out')) {
      return 'Phản hồi AI bị timeout. Thử lại khi backend ổn định hơn.';
    }
    if (s.includes('http 5') || s.includes('500') || s.includes('502') || s.includes('503')) {
      return 'Lỗi server (HTTP 5xx). Kiểm tra logs backend và thử lại.';
    }
    if (s.includes('401') || s.includes('403') || s.includes('unauthorized')) {
      return 'Lỗi xác thực kết nối AI. Kiểm tra API key backend.';
    }
    return raw;
  }

  const renderContextBar = () => {
    const modeLabels: Record<DockMode, string> = {
      brief: 'Briefing',
      chat: 'Hỏi đáp',
      patch_review: 'Duyệt Patch',
      system_status: 'Hệ thống',
    };
    const getModeIcon = (m: DockMode) => {
      switch (m) {
        case 'brief': return FileText;
        case 'chat': return MessageSquare;
        case 'patch_review': return Zap;
        default: return Brain;
      }
    };
    const ModeIcon = getModeIcon(mode);

    return (
      <div className="flex items-center gap-2 px-3 h-9 border-b border-border bg-background-secondary/60 shrink-0">
        <Brain className="w-3.5 h-3.5 text-brand-primary shrink-0" />
        <span className="text-xs font-semibold text-text-primary">CAE</span>
        <span className="w-px h-3 bg-border mx-0.5 shrink-0" />
        <ModeIcon className="w-3 h-3 text-text-tertiary shrink-0" />
        <span className="text-xs text-text-secondary">{modeLabels[mode]}</span>
        <div className="flex-1" />
        {isStreaming && (
          <span className="flex items-center gap-1.5 text-[10px] text-brand-primary font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-breathe" />
            live
          </span>
        )}
        <button
          onClick={togglePin}
          className={`p-1 rounded-sm transition-colors ${isPinned ? 'text-brand-primary bg-brand-light' : 'text-text-tertiary hover:text-text-secondary'}`}
          title={isPinned ? 'Bỏ ghim' : 'Ghim panel'}
        >
          {isPinned ? <Pin className="w-3 h-3" /> : <PinOff className="w-3 h-3" />}
        </button>
      </div>
    );
  };

  const renderThread = () => {
    const activeRun = activeRunRef.current;
    const pastRuns = runSnapshots.filter(run => run.id !== activeRun?.id).slice(0, 5);
    const orderedPastRuns = [...pastRuns].reverse();

    const getModeIcon = (m: DockMode) => {
      switch (m) {
        case 'brief': return FileText;
        case 'chat': return MessageSquare;
        case 'patch_review': return Zap;
        default: return Brain;
      }
    };

    const currentStage = liveStages.find(s => s.status === 'running');
    const stageLabel = currentStage?.label ?? 'Xử lý';

    const renderRunBody = (params: {
      runBlocks: RenderableBlock[];
      runContent: string;
      runCitations: CitationAnchor[];
      runUsage: UsageSnapshot | null;
      runError: string | null;
      runThinking?: string;
      runIsStreaming?: boolean;
      onRetry?: () => void;
    }) => {
      const { runBlocks, runContent, runCitations, runUsage, runError, runThinking, runIsStreaming, onRetry } = params;

      return (
        <div className="px-3 py-3 space-y-3">
          {/* Reasoning — Cursor-style collapsible */}
          {runThinking && (
            <>
              <button
                onClick={() => setShowTrace(v => !v)}
                className="flex items-center gap-1.5 text-[10px] text-text-tertiary hover:text-text-secondary transition-colors"
              >
                <ChevronDown className={`w-3 h-3 transition-transform ${showTrace ? '' : '-rotate-90'}`} />
                <Brain className="w-3 h-3 text-brand-primary/50" />
                <span>Reasoning</span>
              </button>
              {showTrace && (
                <div className="rounded-sm bg-background-secondary border border-border px-2.5 py-2">
                  <p className="text-[10px] text-text-tertiary font-mono leading-relaxed whitespace-pre-wrap max-h-20 overflow-y-auto">
                    {runThinking}
                  </p>
                </div>
              )}
            </>
          )}

          {/* Error — shown instead of content placeholder when errored */}
          {runError ? (
            <div className="space-y-2">
              <div className="flex items-start gap-2 p-2 rounded-sm border border-semantic-error/30 bg-semantic-error/5">
                <AlertCircle className="w-3.5 h-3.5 text-semantic-error shrink-0 mt-0.5" />
                <p className="text-xs text-semantic-error leading-relaxed">{humanizeError(runError)}</p>
              </div>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="flex items-center gap-1.5 text-xs text-brand-primary hover:text-brand-primary/80 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Thử lại
                </button>
              )}
            </div>
          ) : runBlocks.length > 0 ? (
            <BlockRenderer blocks={runBlocks} onCitationClick={onCitationClick} />
          ) : runContent ? (
            <MarkdownContent text={runContent} onCitationClick={onCitationClick} />
          ) : runIsStreaming ? (
            <div className="flex items-center gap-2 text-xs text-text-tertiary">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-primary" />
              <span>Đang tổng hợp kết quả...</span>
            </div>
          ) : (
            <p className="text-xs text-text-tertiary italic">Chưa có nội dung.</p>
          )}

          {/* Footer: citation chips + token count */}
          {(runCitations.length > 0 || (runUsage && !runIsStreaming)) && (
            <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-border/50">
              {runCitations.slice(0, 6).map((cit, i) => (
                <button
                  key={cit.citationId}
                  onClick={() => onCitationClick?.(cit.citationId)}
                  title={cit.documentTitle}
                  className="inline-flex items-center justify-center w-5 h-5 text-[9px] font-bold text-brand-primary bg-brand-light border border-brand-primary/30 rounded-sm hover:bg-brand-primary hover:text-white transition-colors"
                >
                  {i + 1}
                </button>
              ))}
              {runCitations.length > 6 && (
                <span className="text-[10px] text-text-tertiary">+{runCitations.length - 6}</span>
              )}
              {runUsage && !runIsStreaming && (
                <span className="ml-auto text-[10px] text-text-tertiary font-mono">
                  {runUsage.model.split('/').pop()?.slice(0, 14)} · {runUsage.completion_tokens}t
                </span>
              )}
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-3 space-y-2">

          {/* Empty state */}
          {!activeRun && orderedPastRuns.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <Brain className="w-7 h-7 text-text-tertiary/25" />
              <p className="text-xs text-text-tertiary">CAE đang khởi tạo...</p>
            </div>
          )}

          {/* Past runs — collapsible accordions (oldest → newest) */}
          {orderedPastRuns.map(run => {
            const Icon = getModeIcon(run.mode);
            const isExpanded = expandedPastRunId === run.id;
            return (
              <div
                key={run.id}
                className={`rounded-sm border overflow-hidden transition-colors ${
                  isExpanded
                    ? 'border-brand-primary/20 bg-brand-light/5'
                    : 'border-border bg-background-secondary/40 hover:border-border-strong'
                }`}
              >
                <button
                  onClick={() => setExpandedPastRunId(isExpanded ? null : run.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left"
                >
                  <Icon className="w-3 h-3 text-text-tertiary shrink-0" />
                  <span className="text-xs text-text-secondary flex-1 truncate min-w-0">{run.title}</span>
                  {run.citations.length > 0 && (
                    <span className="text-[10px] text-brand-primary/70 font-medium shrink-0">[{run.citations.length}]</span>
                  )}
                  <span className={`text-[10px] font-mono shrink-0 ${run.status === 'error' ? 'text-semantic-error' : 'text-text-tertiary'}`}>
                    {run.status === 'error' ? 'lỗi' : new Date(run.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <ChevronDown className={`w-3 h-3 text-text-tertiary transition-transform shrink-0 ${isExpanded ? '' : '-rotate-90'}`} />
                </button>
                {isExpanded && (
                  <div className="border-t border-border/60">
                    {renderRunBody({
                      runBlocks: run.blocks,
                      runContent: run.content,
                      runCitations: run.citations,
                      runUsage: run.usage,
                      runError: run.error,
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Active run — always expanded, content streams in */}
          {activeRun && (
            <div className={`rounded-sm border overflow-hidden bg-surface shadow-sm ${displayError ? 'border-semantic-error/30' : 'border-brand-primary/25'}`}>
              <div className={`flex items-center gap-2 px-3 py-2 border-b ${displayError ? 'bg-semantic-error/5 border-semantic-error/20' : 'bg-brand-light/15 border-brand-primary/15'}`}>
                {(() => { const Icon = getModeIcon(activeRun.mode); return <Icon className={`w-3 h-3 shrink-0 ${displayError ? 'text-semantic-error' : 'text-brand-primary'}`} />; })()}
                <span className="text-xs font-medium text-text-primary flex-1 truncate min-w-0">{activeRun.title}</span>
                {isStreaming ? (
                  <span className="flex items-center gap-1.5 text-[10px] text-brand-primary font-medium shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-breathe" />
                    {stageLabel}
                  </span>
                ) : displayError ? (
                  <AlertCircle className="w-3.5 h-3.5 text-semantic-error shrink-0" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-semantic-success shrink-0" />
                )}
              </div>
              {renderRunBody({
                runBlocks: displayBlocks,
                runContent: displayContent,
                runCitations: displayCitations,
                runUsage: displayUsage,
                runError: displayError,
                runThinking: thinking || undefined,
                runIsStreaming: isStreaming,
                onRetry: displayError && activeRun?.mode === 'brief' ? () => {
                  abort();
                  reset();
                  beginRun('brief', 'Tóm tắt ca hiện tại');
                  startBrief(episodeId, { findingIds });
                } : displayError ? () => {
                  // For chat runs, just clear error and allow user to re-send
                  reset();
                } : undefined,
              })}
            </div>
          )}

        </div>
      </div>
    );
  };

  // Handle citation interactions
  const handleCitationClick = (citationId: string) => {
    setActiveCitationId(citationId);
    onCitationClick?.(citationId);
  };

  const handleCitationHover = (citationId: string | null) => {
    onCitationHover?.(citationId);
  };

  if (fullWidth) {
    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-surface">
        {renderContextBar()}
        {renderThread()}
        {renderActionZone()}
      </div>
    );
  }

  return (
    <div
      className={`${widthClass} transition-all duration-300 ease-in-out flex border-l border-border bg-surface h-full`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {renderHandle()}

      <div className="flex-1 flex flex-col overflow-hidden">
        {renderModeHeader()}
        {renderSummary()}
        {renderContent()}
        {renderActionZone()}
      </div>

      {/* Evidence Rail - shown in focus state */}
      {state === 'focus' && displayCitations.length > 0 && (
        <EvidenceRail
          citations={displayCitations}
          activeCitationId={activeCitationId}
          onCitationClick={handleCitationClick}
          onCitationHover={handleCitationHover}
        />
      )}
    </div>
  );
}
