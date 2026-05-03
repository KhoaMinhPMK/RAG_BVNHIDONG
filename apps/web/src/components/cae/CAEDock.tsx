/**
 * CAE Dock - Adaptive AI Panel
 *
 * Replaces static CAEPanel with adaptive dock that can collapse/expand based on context.
 * 6 states: collapsed, peek, task, focus, compose, pinned
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Pin, PinOff, ChevronLeft, ChevronRight, Brain, CheckCircle2, Loader2, AlertCircle, Send } from 'lucide-react';
import { BlockRenderer } from './BlockRenderer';
import { EvidenceRail } from './EvidenceRail';
import { useCAEStream } from '@/hooks/useCAEStream';
import type { RenderableBlock, CitationAnchor } from '@/types/cae-output';

export type DockState = 'collapsed' | 'peek' | 'task' | 'focus' | 'compose' | 'pinned';
export type DockMode = 'brief' | 'chat' | 'patch_review' | 'system_status';

interface CAEDockProps {
  episodeId: string;
  currentStep: 'detection' | 'explain' | 'draft';
  onCitationClick?: (citationId: string) => void;
  onCitationHover?: (citationId: string | null) => void;
  onActivityDetected?: () => void;
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

export function CAEDock({ episodeId, currentStep, onCitationClick, onCitationHover, onActivityDetected }: CAEDockProps) {
  const [state, setState] = useState<DockState>('collapsed');
  const [mode, setMode] = useState<DockMode>('brief');
  const [isPinned, setIsPinned] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [input, setInput] = useState('');
  const [activeCitationId, setActiveCitationId] = useState<string | null>(null);

  const {
    isStreaming,
    thinking,
    toolCalls,
    content,
    blocks,
    citations,
    error,
    usage,
    startBrief,
    startChat,
    abort,
    reset,
  } = useCAEStream();

  const hoverTimeoutRef = useRef<NodeJS.Timeout>();
  const collapseTimeoutRef = useRef<NodeJS.Timeout>();
  const previousStateRef = useRef<DockState>('task');
  const hasLoadedBriefRef = useRef(false);

  // Auto-load brief when episode changes
  useEffect(() => {
    if (episodeId && !hasLoadedBriefRef.current) {
      hasLoadedBriefRef.current = true;
      startBrief(episodeId);
      setState('peek'); // Auto-open to peek when brief arrives
    }
  }, [episodeId, startBrief]);

  // Auto-open to peek when streaming starts
  useEffect(() => {
    if (isStreaming && state === 'collapsed') {
      setState('peek');
    }
  }, [isStreaming, state]);

  // Extract summary from blocks
  const summary = blocks.find(b => b.type === 'summary')?.text ||
                  blocks.find(b => b.type === 'paragraph')?.text.slice(0, 100) ||
                  '';

  // Auto-expand to focus state when citations arrive
  useEffect(() => {
    if (citations.length > 0 && state === 'task' && !isPinned) {
      setState('focus');
    }
  }, [citations.length, state, isPinned]);

  // Auto-collapse after inactivity
  useEffect(() => {
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

    if (state === 'collapsed' || state === 'peek') {
      hoverTimeoutRef.current = setTimeout(() => {
        if (!isPinned) {
          setState('task');
        }
      }, HOVER_EXPAND_DELAY);
    }
  }, [state, isPinned]);

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
  const renderHandle = () => (
    <div className="flex flex-col items-center gap-2 py-3 px-2 border-r border-border bg-background-secondary">
      <button
        onClick={expandDock}
        className="p-1.5 rounded hover:bg-background transition-colors"
        aria-label="Expand dock"
      >
        <ChevronLeft className="w-4 h-4 text-text-secondary" />
      </button>

      {state !== 'collapsed' && (
        <>
          <div className="flex-1 flex items-center">
            <div className="w-1 h-12 rounded-full bg-brand-primary/30" />
          </div>

          <button
            onClick={togglePin}
            className={`p-1.5 rounded transition-colors ${
              isPinned
                ? 'bg-brand-primary/10 text-brand-primary'
                : 'hover:bg-background text-text-tertiary'
            }`}
            aria-label={isPinned ? 'Unpin dock' : 'Pin dock'}
          >
            {isPinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
          </button>

          <button
            onClick={collapseDock}
            className="p-1.5 rounded hover:bg-background transition-colors"
            aria-label="Collapse dock"
          >
            <ChevronRight className="w-4 h-4 text-text-secondary" />
          </button>
        </>
      )}
    </div>
  );

  // Render mode header
  const renderModeHeader = () => {
    if (state === 'collapsed') return null;

    const modeLabels: Record<DockMode, string> = {
      brief: 'CAE Briefing',
      chat: 'Hỏi CAE',
      patch_review: 'Duyệt Patch',
      system_status: 'Trạng thái hệ thống',
    };

    return (
      <div className="px-3 py-2 border-b border-border bg-background-secondary/60">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
          {modeLabels[mode]}
        </p>
      </div>
    );
  };

  // Render summary strip
  const renderSummary = () => {
    if (state === 'collapsed' || !summary) return null;

    return (
      <div className="px-3 py-2 border-b border-border">
        <p className="text-xs text-text-primary leading-relaxed line-clamp-2">
          {summary}
        </p>
      </div>
    );
  };

  // Render content based on state
  const renderContent = () => {
    if (state === 'collapsed') return null;
    if (state === 'peek') return null; // Only summary in peek mode

    return (
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
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
          <div className="border border-brand-primary/20 rounded-sm bg-brand-light/10 p-2">
            <div className="flex items-center gap-2 mb-1">
              <Brain className="w-3 h-3 text-brand-primary shrink-0" />
              <span className="text-[10px] font-semibold text-brand-primary uppercase tracking-wider">
                CAE reasoning
              </span>
            </div>
            <p className="text-[10px] text-text-secondary leading-relaxed whitespace-pre-wrap font-mono max-h-24 overflow-y-auto">
              {thinking}
            </p>
          </div>
        )}

        {/* Structured blocks */}
        {blocks.length > 0 ? (
          <BlockRenderer blocks={blocks} onCitationClick={onCitationClick} />
        ) : content && !isStreaming ? (
          <p className="text-xs text-text-primary leading-relaxed whitespace-pre-wrap">{content}</p>
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
        {error && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-sm border border-semantic-error/30 bg-semantic-error/5">
            <AlertCircle className="w-3.5 h-3.5 text-semantic-error shrink-0 mt-0.5" />
            <p className="text-xs text-semantic-error">{error}</p>
          </div>
        )}

        {/* Usage info */}
        {usage && !isStreaming && (
          <div className="flex items-center gap-3 text-[10px] text-text-tertiary font-mono">
            <span>{usage.model}</span>
            {usage.reasoning_tokens > 0 && <span>{usage.reasoning_tokens} reasoning</span>}
            <span>{usage.completion_tokens} tokens</span>
          </div>
        )}
      </div>
    );
  };

  // Render action zone
  const renderActionZone = () => {
    if (state === 'collapsed' || state === 'peek') return null;

    const handleSend = () => {
      if (!input.trim() || isStreaming) return;

      setMode('chat');
      startChat(episodeId, [{ role: 'user', content: input }]);
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
          className="flex-1 text-xs border border-border rounded-sm px-2.5 py-1.5 bg-background focus:outline-none focus:border-brand-primary text-text-primary placeholder:text-text-tertiary disabled:opacity-50"
          onFocus={onActivityDetected}
          disabled={isStreaming}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isStreaming}
          className="w-8 h-8 flex items-center justify-center rounded-sm bg-brand-primary text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
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

  return (
    <div
      className={`${widthClass} transition-all duration-300 ease-in-out flex border-l border-border bg-background h-full`}
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
      {state === 'focus' && citations.length > 0 && (
        <EvidenceRail
          citations={citations}
          activeCitationId={activeCitationId}
          onCitationClick={handleCitationClick}
          onCitationHover={handleCitationHover}
        />
      )}
    </div>
  );
}
