/**
 * useCAEStream - Custom hook for CAE SSE streaming
 */

import { useState, useRef, useCallback } from 'react';
import type { RenderableBlock, CitationAnchor, CAESSEEvent, DoneEvent, UIAction } from '@/types/cae-output';

interface CAEStreamContext {
  findingIds?: string[];
}

interface CAEDetectionPayload {
  image_id: string;
  detections: Array<{
    bbox: [number, number, number, number];
    label: string;
    score: number;
  }>;
  model_version?: string;
  timestamp?: string;
}

interface ToolCall {
  name: string;
  label: string;
  status: 'running' | 'done' | 'error';
  preview?: string;
}

interface UseCAEStreamResult {
  isStreaming: boolean;
  thinking: string;
  toolCalls: ToolCall[];
  content: string;
  blocks: RenderableBlock[];
  citations: CitationAnchor[];
  actions: UIAction[];
  error: string | null;
  usage: { reasoning_tokens: number; completion_tokens: number; model: string } | null;
  startBrief: (episodeId: string, context?: CAEStreamContext) => Promise<void>;
  startChat: (episodeId: string, messages: Array<{ role: 'user' | 'assistant'; content: string }>, context?: CAEStreamContext) => Promise<void>;
  startExplain: (episodeId: string, detection: CAEDetectionPayload, context?: CAEStreamContext & { clinicalData?: Record<string, unknown> }) => Promise<void>;
  startDraft: (episodeId: string, templateId: string, detection: CAEDetectionPayload, context?: CAEStreamContext & { clinicalData?: Record<string, unknown> }) => Promise<void>;
  abort: () => void;
  reset: () => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

async function consumeCAESSE(
  url: string,
  body: Record<string, unknown>,
  callbacks: {
    onThinking: (delta: string) => void;
    onToolStart: (name: string, label: string, args: Record<string, unknown>) => void;
    onToolDone: (name: string, preview: string) => void;
    onContent: (delta: string) => void;
    onBlockStart: (blockType: string, blockIndex: number) => void;
    onBlockDone: (blockIndex: number, block: RenderableBlock) => void;
    onCitation: (citation: CitationAnchor) => void;
    onUIAction: (action: UIAction) => void;
    onDone: (event: DoneEvent) => void;
    onError: (msg: string) => void;
  },
  signal: AbortSignal
) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
    credentials: 'include',
  });

  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const event: CAESSEEvent = JSON.parse(line.slice(6));
        switch (event.type) {
          case 'thinking':
            callbacks.onThinking(event.delta ?? '');
            break;
          case 'tool_start':
            callbacks.onToolStart(event.name!, event.label!, event.args ?? {});
            break;
          case 'tool_done':
            callbacks.onToolDone(event.name!, event.preview ?? '');
            break;
          case 'content':
            callbacks.onContent(event.delta ?? '');
            break;
          case 'block_start':
            if (event.blockType !== undefined && event.blockIndex !== undefined) {
              callbacks.onBlockStart(event.blockType, event.blockIndex);
            }
            break;
          case 'block_done':
            if (event.blockIndex !== undefined && event.block) {
              callbacks.onBlockDone(event.blockIndex, event.block);
            }
            break;
          case 'citation':
            callbacks.onCitation(event.citation);
            break;
          case 'ui_action':
            callbacks.onUIAction(event.action);
            break;
          case 'done':
            callbacks.onDone(event);
            break;
          case 'error':
            callbacks.onError(event.message ?? 'Lỗi không xác định');
            break;
          case 'block_content':
            break;
        }
      } catch {
        // skip malformed chunks
      }
    }
  }
}

export function useCAEStream(): UseCAEStreamResult {
  const [isStreaming, setIsStreaming] = useState(false);
  const [thinking, setThinking] = useState('');
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [content, setContent] = useState('');
  const [blocks, setBlocks] = useState<RenderableBlock[]>([]);
  const [citations, setCitations] = useState<CitationAnchor[]>([]);
  const [actions, setActions] = useState<UIAction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ reasoning_tokens: number; completion_tokens: number; model: string } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const blocksRef = useRef<RenderableBlock[]>([]);
  const citationsRef = useRef<CitationAnchor[]>([]);
  const actionsRef = useRef<UIAction[]>([]);

  const reset = useCallback(() => {
    setThinking('');
    setToolCalls([]);
    setContent('');
    setBlocks([]);
    setCitations([]);
    setActions([]);
    setError(null);
    setUsage(null);
    blocksRef.current = [];
    citationsRef.current = [];
    actionsRef.current = [];
  }, []);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const startStream = useCallback(async (url: string, body: Record<string, unknown>) => {
    reset();
    setIsStreaming(true);
    setError(null);

    abortControllerRef.current = new AbortController();

    // Track whether the stream ended with a proper done/error event.
    // If consumeCAESSE returns without either, the connection dropped mid-stream.
    let streamCompleted = false;

    try {
      await consumeCAESSE(
        url,
        body,
        {
          onThinking: (delta) => setThinking((prev) => prev + delta),
          onToolStart: (name, label, _args) => {
            setToolCalls((prev) => [...prev, { name, label, status: 'running' }]);
          },
          onToolDone: (name, preview) => {
            setToolCalls((prev) =>
              prev.map((t) => (t.name === name && t.status === 'running' ? { ...t, status: 'done', preview } : t))
            );
          },
          onContent: (delta) => setContent((prev) => prev + delta),
          onBlockStart: (_blockType, _blockIndex) => {},
          onBlockDone: (_blockIndex, block) => {
            blocksRef.current = [...blocksRef.current, block];
            setBlocks([...blocksRef.current]);
          },
          onCitation: (citation) => {
            citationsRef.current = [...citationsRef.current, citation];
            setCitations([...citationsRef.current]);
          },
          onUIAction: (action) => {
            actionsRef.current = [...actionsRef.current, action];
            setActions([...actionsRef.current]);
          },
          onDone: (event) => {
            streamCompleted = true;
            if (event.type === 'done') {
              setUsage({
                reasoning_tokens: event.reasoning_tokens ?? 0,
                completion_tokens: event.completion_tokens ?? 0,
                model: event.model ?? 'unknown',
              });
            }
            setIsStreaming(false);
          },
          onError: (msg) => {
            streamCompleted = true;
            setError(msg);
            setIsStreaming(false);
          },
        },
        abortControllerRef.current.signal
      );

      // If the SSE connection closed without a done/error event (server
      // disconnect, timeout, proxy cut), ensure we always leave streaming state.
      if (!streamCompleted) {
        setError('Kết nối bị ngắt giữa chừng. Kiểm tra backend và thử lại.');
        setIsStreaming(false);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
      setIsStreaming(false);
    }
  }, [reset]);

  const startBrief = useCallback(
    async (episodeId: string, context?: CAEStreamContext) => {
      await startStream(`${API_BASE}/api/cae/brief`, {
        episode_id: episodeId,
        finding_ids: context?.findingIds,
      });
    },
    [startStream]
  );

  const startChat = useCallback(
    async (
      episodeId: string,
      messages: Array<{ role: 'user' | 'assistant'; content: string }>,
      context?: CAEStreamContext
    ) => {
      await startStream(`${API_BASE}/api/cae/chat`, {
        episode_id: episodeId,
        messages,
        finding_ids: context?.findingIds,
      });
    },
    [startStream]
  );

  const startExplain = useCallback(
    async (
      episodeId: string,
      detection: CAEDetectionPayload,
      context?: CAEStreamContext & { clinicalData?: Record<string, unknown> }
    ) => {
      await startStream(`${API_BASE}/api/cae/explain`, {
        episode_id: episodeId,
        detection,
        finding_ids: context?.findingIds,
        clinical_data: context?.clinicalData,
      });
    },
    [startStream]
  );

  const startDraft = useCallback(
    async (
      episodeId: string,
      templateId: string,
      detection: CAEDetectionPayload,
      context?: CAEStreamContext & { clinicalData?: Record<string, unknown> }
    ) => {
      await startStream(`${API_BASE}/api/cae/draft`, {
        episode_id: episodeId,
        template_id: templateId,
        detection,
        finding_ids: context?.findingIds,
        clinical_data: context?.clinicalData,
      });
    },
    [startStream]
  );

  return {
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
    startExplain,
    startDraft,
    abort,
    reset,
  };
}
