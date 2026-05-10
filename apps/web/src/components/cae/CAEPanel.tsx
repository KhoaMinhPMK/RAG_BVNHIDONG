'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, Bot, Brain, CheckCircle2, ChevronDown, ChevronUp,
  Loader2, MessageSquare, RefreshCw, Send, Volume2, Zap,
} from 'lucide-react';
import { getApiBaseUrl, jsonAuthHeaders } from '@/lib/api/client';
import { BlockRenderer } from './BlockRenderer';
import type { RenderableBlock, CitationAnchor, CAESSEEvent, DoneEvent } from '@/types/cae-output';

type CAEMode = 'auto' | 'chat';
type CAEStep = 'detection' | 'explain' | 'draft';

interface ToolCall {
  name: string;
  label: string;
  status: 'running' | 'done' | 'error';
  preview?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  blocks?: RenderableBlock[];
  citations?: CitationAnchor[];
}

// Default fallback for backward compatibility
const FALLBACK_EVENT: CAESSEEvent = { type: 'content', delta: '' };

const TOOL_ICONS: Record<string, string> = {
  get_patient_context: 'Ho so',
  search_knowledge_base: 'KB',
  get_detection_results: 'XQ',
  save_draft_report: 'Draft',
};

const STEP_PROMPTS: Record<CAEStep, string[]> = {
  detection: [
    'Finding nào cần ưu tiên chú ý?',
    'Điểm nào có nguy cơ bị bỏ sót trên phim?',
  ],
  explain: [
    'Tóm tắt chứng cứ nội bộ liên quan ca này.',
    'Có mâu thuẫn nào giữa X-quang và lâm sàng không?',
  ],
  draft: [
    'Rà soát nháp trước khi bác sĩ xác nhận.',
    'Field nào đang mạnh hơn mức evidence?',
  ],
};

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
    onDone: (event: DoneEvent) => void;
    onError: (msg: string) => void;
  },
  signal: AbortSignal
) {
  const headers = await jsonAuthHeaders();
  const res = await fetch(url, {
    method: 'POST',
    headers,
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
          case 'done':
            callbacks.onDone(event);
            break;
          case 'error':
            callbacks.onError(event.message ?? 'Lỗi không xác định');
            break;
          case 'ui_action':
          case 'block_content':
            break;
        }
      } catch {
        // skip malformed chunks
      }
    }
  }
}

function ThinkingBox({ thinking }: { thinking: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!thinking) return null;

  return (
    <div className="border border-brand-primary/20 rounded-sm bg-brand-light/10 overflow-hidden">
      <button
        onClick={() => setExpanded((value) => !value)}
        className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-brand-light/20 transition-colors"
      >
        <Brain className="w-3 h-3 text-brand-primary shrink-0" />
        <span className="text-[10px] font-semibold text-brand-primary uppercase tracking-wider">
          CAE reasoning
        </span>
        {expanded
          ? <ChevronUp className="w-3 h-3 text-brand-primary ml-auto" />
          : <ChevronDown className="w-3 h-3 text-brand-primary ml-auto" />}
      </button>
      {expanded && (
        <div className="px-2.5 pb-2.5 max-h-32 overflow-y-auto">
          <p className="text-[10px] text-text-secondary leading-relaxed whitespace-pre-wrap font-mono">
            {thinking}
          </p>
        </div>
      )}
    </div>
  );
}

function ToolCallCard({ tool }: { tool: ToolCall }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-sm border border-border bg-background-secondary text-[10px]">
      <span className="font-semibold text-text-primary shrink-0">{TOOL_ICONS[tool.name] ?? 'Tool'}</span>
      <span className="text-text-secondary truncate flex-1">{tool.label}</span>
      {tool.status === 'running' && <Loader2 className="w-3 h-3 animate-spin text-brand-primary shrink-0" />}
      {tool.status === 'done' && <CheckCircle2 className="w-3 h-3 text-semantic-success shrink-0" />}
    </div>
  );
}

export default function CAEPanel({ episodeId, currentStep }: { episodeId: string; currentStep: CAEStep }) {
  const [mode, setMode] = useState<CAEMode>('auto');
  const [isStreaming, setIsStreaming] = useState(false);
  const [thinking, setThinking] = useState('');
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [content, setContent] = useState('');
  const [blocks, setBlocks] = useState<RenderableBlock[]>([]);
  const [citations, setCitations] = useState<CitationAnchor[]>([]);
  const [usage, setUsage] = useState<{ reasoning_tokens: number; completion_tokens: number; model: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTtsLoading, setIsTtsLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const contentRef = useRef('');
  const thinkingRef = useRef('');
  const blocksRef = useRef<RenderableBlock[]>([]);
  const citationsRef = useRef<CitationAnchor[]>([]);
  const endRef = useRef<HTMLDivElement | null>(null);

  const prompts = useMemo(() => STEP_PROMPTS[currentStep], [currentStep]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [content, toolCalls, chatHistory]);

  const resetState = useCallback(() => {
    setThinking('');
    setToolCalls([]);
    setContent('');
    setBlocks([]);
    setCitations([]);
    setUsage(null);
    setError(null);
    contentRef.current = '';
    thinkingRef.current = '';
    blocksRef.current = [];
    citationsRef.current = [];
  }, []);

  const startBrief = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    resetState();
    setIsStreaming(true);

    try {
      await consumeCAESSE(
        `${getApiBaseUrl()}/api/cae/brief`,
        { episode_id: episodeId },
        {
          onThinking: (delta) => {
            thinkingRef.current += delta;
            setThinking(thinkingRef.current);
          },
          onToolStart: (name, label) => {
            setToolCalls((prev) => [...prev, { name, label, status: 'running' }]);
          },
          onToolDone: (name, preview) => {
            setToolCalls((prev) => prev.map((tool) => (
              tool.name === name && tool.status === 'running'
                ? { ...tool, status: 'done', preview }
                : tool
            )));
          },
          onContent: (delta) => {
            contentRef.current += delta;
            setContent(contentRef.current);
          },
          onBlockStart: (_blockType, _blockIndex) => {
            // Block start - could show skeleton loader
          },
          onBlockDone: (blockIndex, block) => {
            blocksRef.current[blockIndex] = block;
            setBlocks([...blocksRef.current]);
          },
          onCitation: (citation) => {
            citationsRef.current.push(citation);
            setCitations([...citationsRef.current]);
          },
          onDone: (event) => {
            setUsage({
              reasoning_tokens: event.reasoning_tokens ?? 0,
              completion_tokens: event.completion_tokens ?? 0,
              model: event.model ?? 'mimo-v2.5-pro',
            });
            setIsStreaming(false);
          },
          onError: (message) => {
            setError(message);
            setIsStreaming(false);
          },
        },
        ctrl.signal
      );
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        setError((err as Error)?.message ?? 'Lỗi kết nối CAE');
        setIsStreaming(false);
      }
    }
  }, [episodeId, resetState]);

  const sendChat = useCallback(async () => {
    const question = input.trim();
    if (!question || isStreaming) return;
    setInput('');

    const nextHistory: ChatMessage[] = [...chatHistory, { role: 'user', content: question }];
    setChatHistory(nextHistory);

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    resetState();
    setMode('chat');
    setIsStreaming(true);

    try {
      await consumeCAESSE(
        `${getApiBaseUrl()}/api/cae/chat`,
        { episode_id: episodeId, messages: nextHistory },
        {
          onThinking: (delta) => {
            thinkingRef.current += delta;
            setThinking(thinkingRef.current);
          },
          onToolStart: (name, label) => {
            setToolCalls((prev) => [...prev, { name, label, status: 'running' }]);
          },
          onToolDone: (name, preview) => {
            setToolCalls((prev) => prev.map((tool) => (
              tool.name === name && tool.status === 'running'
                ? { ...tool, status: 'done', preview }
                : tool
            )));
          },
          onContent: (delta) => {
            contentRef.current += delta;
            setContent(contentRef.current);
          },
          onBlockStart: (_blockType, _blockIndex) => {
            // Block start - could show skeleton loader
          },
          onBlockDone: (blockIndex, block) => {
            blocksRef.current[blockIndex] = block;
            setBlocks([...blocksRef.current]);
          },
          onCitation: (citation) => {
            citationsRef.current.push(citation);
            setCitations([...citationsRef.current]);
          },
          onDone: (event) => {
            setUsage({
              reasoning_tokens: event.reasoning_tokens ?? 0,
              completion_tokens: event.completion_tokens ?? 0,
              model: event.model ?? 'mimo-v2.5-pro',
            });
            setChatHistory((history) => [...history, {
              role: 'assistant',
              content: contentRef.current,
              blocks: [...blocksRef.current],
              citations: [...citationsRef.current],
            }]);
            setIsStreaming(false);
          },
          onError: (message) => {
            setError(message);
            setIsStreaming(false);
          },
        },
        ctrl.signal
      );
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        setError((err as Error)?.message ?? 'Lỗi kết nối CAE');
        setIsStreaming(false);
      }
    }
  }, [chatHistory, episodeId, input, isStreaming, resetState]);

  const handleTts = useCallback(async () => {
    if (!content || isTtsLoading) return;
    setIsTtsLoading(true);
    try {
      const headers = await jsonAuthHeaders();
      const response = await fetch(`${getApiBaseUrl()}/api/cae/tts`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text: content.slice(0, 1500), voice: 'Mia' }),
        credentials: 'include',
      });

      if (!response.ok) throw new Error(`TTS HTTP ${response.status}`);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play();
    } catch (err) {
      console.error('[CAE TTS]', err);
    } finally {
      setIsTtsLoading(false);
    }
  }, [content, isTtsLoading]);

  useEffect(() => {
    if (mode === 'auto') {
      startBrief();
    }
    return () => abortRef.current?.abort();
  }, [episodeId, mode, startBrief]);

  return (
    <div className="border border-border rounded-sm bg-surface shrink-0 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-brand-primary" />
          <span className="text-xs font-semibold text-text-primary">CAE</span>
          <span className="text-[10px] text-text-tertiary">Clinical AI Engine</span>
          {isStreaming && (
            <span className="flex items-center gap-1 text-[10px] text-brand-primary">
              <Loader2 className="w-3 h-3 animate-spin" />
              Đang phân tích
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center border border-border rounded-sm overflow-hidden">
            <button
              onClick={() => setMode('auto')}
              className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium transition-colors ${mode === 'auto' ? 'bg-brand-primary text-white' : 'bg-surface text-text-tertiary hover:bg-background-secondary'}`}
            >
              <Zap className="w-3 h-3" />
              Brief
            </button>
            <button
              onClick={() => setMode('chat')}
              className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium transition-colors ${mode === 'chat' ? 'bg-brand-primary text-white' : 'bg-surface text-text-tertiary hover:bg-background-secondary'}`}
            >
              <MessageSquare className="w-3 h-3" />
              Chat
            </button>
          </div>

          {mode === 'auto' && !isStreaming && (
            <button onClick={startBrief} title="Phân tích lại" className="p-1 text-text-tertiary hover:text-text-primary transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}

          {content && !isStreaming && (
            <button onClick={handleTts} disabled={isTtsLoading} title="Đọc briefing" className="p-1 text-text-tertiary hover:text-brand-primary transition-colors disabled:opacity-40">
              {isTtsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      <div className="p-3 space-y-3">
        {mode === 'auto' ? (
          <>
            {!content && blocks.length === 0 && isStreaming && (
              <div className="space-y-2 animate-pulse">
                <div className="h-3 bg-background-secondary rounded-sm w-2/3" />
                <div className="h-3 bg-background-secondary rounded-sm w-full" />
                <div className="h-3 bg-background-secondary rounded-sm w-4/5" />
              </div>
            )}

            {blocks.length > 0 && (
              <div className="rounded-sm border border-border bg-background-secondary/60 p-3">
                <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1.5">CAE Briefing</p>
                <BlockRenderer blocks={blocks} />
              </div>
            )}

            {content && blocks.length === 0 && (
              <div className="rounded-sm border border-border bg-background-secondary/60 p-3">
                <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1.5">CAE Briefing</p>
                <p className="text-xs text-text-primary leading-relaxed whitespace-pre-wrap">{content}</p>
              </div>
            )}

            {toolCalls.length > 0 && (
              <div className="grid grid-cols-2 gap-1.5">
                {toolCalls.map((tool, index) => <ToolCallCard key={`${tool.name}-${index}`} tool={tool} />)}
              </div>
            )}

            <div className="rounded-sm border border-border bg-background-secondary/60 p-3">
              <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1.5">CAE chú ý trong bước này</p>
              <div className="flex flex-wrap gap-1.5">
                {prompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => {
                      setMode('chat');
                      setInput(prompt);
                    }}
                    className="text-[10px] px-2 py-1 border border-border rounded-sm text-text-secondary hover:bg-background hover:border-brand-primary transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
              {chatHistory.length === 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {prompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => setInput(prompt)}
                      className="text-[10px] px-2 py-1 border border-border rounded-sm text-text-secondary hover:bg-background-secondary hover:border-brand-primary transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}

              {chatHistory.map((message, index) => (
                <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[88%] px-2.5 py-2 rounded-sm text-xs leading-relaxed ${message.role === 'user' ? 'bg-brand-primary text-white' : 'bg-background-secondary border border-border text-text-primary'}`}>
                    {message.role === 'assistant' && message.blocks && message.blocks.length > 0 ? (
                      <BlockRenderer blocks={message.blocks} />
                    ) : (
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    )}
                  </div>
                </div>
              ))}

              {isStreaming && (
                <div className="flex justify-start">
                  <div className="max-w-[88%] px-2.5 py-2 rounded-sm text-xs leading-relaxed bg-background-secondary border border-border text-text-primary">
                    {blocks.length > 0 ? (
                      <BlockRenderer blocks={blocks} />
                    ) : content ? (
                      <div className="whitespace-pre-wrap">
                        {content}
                        <span className="inline-block w-0.5 h-3 bg-brand-primary ml-0.5 animate-pulse align-middle" />
                      </div>
                    ) : (
                      <span className="inline-block w-0.5 h-3 bg-brand-primary animate-pulse" />
                    )}
                  </div>
                </div>
              )}

              <div ref={endRef} />
            </div>

            {toolCalls.length > 0 && (
              <div className="grid grid-cols-2 gap-1.5">
                {toolCalls.map((tool, index) => <ToolCallCard key={`${tool.name}-${index}`} tool={tool} />)}
              </div>
            )}
          </>
        )}

        <ThinkingBox thinking={thinking} />

        {usage && !isStreaming && (
          <div className="flex items-center gap-3 text-[10px] text-text-tertiary font-mono">
            <span>{usage.model}</span>
            {usage.reasoning_tokens > 0 && <span>{usage.reasoning_tokens} reasoning</span>}
            <span>{usage.completion_tokens} tokens</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-sm border border-semantic-error/30 bg-semantic-error/5">
            <AlertCircle className="w-3.5 h-3.5 text-semantic-error shrink-0 mt-0.5" />
            <p className="text-xs text-semantic-error">{error}</p>
          </div>
        )}
      </div>

      <div className="border-t border-border p-2 flex gap-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              sendChat();
            }
          }}
          disabled={isStreaming}
          placeholder="Hỏi CAE về ca bệnh này..."
          className="flex-1 text-xs border border-border rounded-sm px-2.5 py-1.5 bg-background focus:outline-none focus:border-brand-primary text-text-primary placeholder:text-text-tertiary disabled:opacity-50"
        />
        <button onClick={sendChat} disabled={!input.trim() || isStreaming} className="w-8 h-8 flex items-center justify-center rounded-sm bg-brand-primary text-white disabled:opacity-40 hover:opacity-90 transition-opacity">
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="px-3 py-2 border-t border-border bg-semantic-warning/5">
        <p className="text-[10px] text-text-secondary leading-relaxed">
          CAE là lớp hỗ trợ lâm sàng tích hợp trong workflow. Kết quả cần bác sĩ xem xét và xác nhận trước khi sử dụng cho quyết định điều trị.
        </p>
      </div>
    </div>
  );
}