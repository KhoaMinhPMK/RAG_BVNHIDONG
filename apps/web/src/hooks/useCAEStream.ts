/**
 * useCAEStream - Custom hook for CAE SSE streaming
 */

import { useState, useRef, useCallback } from 'react';
import type { RenderableBlock, CitationAnchor, CAESSEEvent } from '@/types/cae-output';

interface ExtendedCAESSEEvent extends CAESSEEvent {
  blockType?: string;
  blockIndex?: number;
  block?: RenderableBlock;
  citation?: CitationAnchor;
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
  error: string | null;
  usage: { reasoning_tokens: number; completion_tokens: number; model: string } | null;
  startBrief: (episodeId: string) => Promise<void>;
  startChat: (episodeId: string, messages: Array<{ role: 'user' | 'assistant'; content: string }>) => Promise<void>;
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
    onDone: (event: CAESSEEvent) => void;
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
        const event: ExtendedCAESSEEvent = JSON.parse(line.slice(6));
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
            if (event.citation) {
              callbacks.onCitation(event.citation);
            }
            break;
          case 'done':
            callbacks.onDone(event);
            break;
          case 'error':
            callbacks.onError(event.message ?? 'Lỗi không xác định');
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
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ reasoning_tokens: number; completion_tokens: number; model: string } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const blocksRef = useRef<RenderableBlock[]>([]);
  const citationsRef = useRef<CitationAnchor[]>([]);

  const reset = useCallback(() => {
    setThinking('');
    setToolCalls([]);
    setContent('');
    setBlocks([]);
    setCitations([]);
    setError(null);
    setUsage(null);
    blocksRef.current = [];
    citationsRef.current = [];
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

    try {
      await consumeCAESSE(
        url,
        body,
        {
          onThinking: (delta) => setThinking((prev) => prev + delta),
          onToolStart: (name, label, args) => {
            setToolCalls((prev) => [...prev, { name, label, status: 'running' }]);
          },
          onToolDone: (name, preview) => {
            setToolCalls((prev) =>
              prev.map((t) => (t.name === name && t.status === 'running' ? { ...t, status: 'done', preview } : t))
            );
          },
          onContent: (delta) => setContent((prev) => prev + delta),
          onBlockStart: (blockType, blockIndex) => {
            // Block start event
          },
          onBlockDone: (blockIndex, block) => {
            blocksRef.current = [...blocksRef.current, block];
            setBlocks([...blocksRef.current]);
          },
          onCitation: (citation) => {
            citationsRef.current = [...citationsRef.current, citation];
            setCitations([...citationsRef.current]);
          },
          onDone: (event) => {
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
            setError(msg);
            setIsStreaming(false);
          },
        },
        abortControllerRef.current.signal
      );
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
      setIsStreaming(false);
    }
  }, [reset]);

  const startBrief = useCallback(
    async (episodeId: string) => {
      await startStream(`${API_BASE}/api/cae/brief`, { episode_id: episodeId });
    },
    [startStream]
  );

  const startChat = useCallback(
    async (episodeId: string, messages: Array<{ role: 'user' | 'assistant'; content: string }>) => {
      await startStream(`${API_BASE}/api/cae/chat`, { episode_id: episodeId, messages });
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
    error,
    usage,
    startBrief,
    startChat,
    abort,
    reset,
  };
}
