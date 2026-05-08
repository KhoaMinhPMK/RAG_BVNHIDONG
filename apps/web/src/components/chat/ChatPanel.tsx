'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import {
  Send, Square, Plus, Loader2, Bot, MessageSquare,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ChatSession } from '@/lib/api/sessions';
import type { ChatMessage } from '@/lib/api/sessions';
import type { StreamState, StreamingMessage } from '@/hooks/useChatSession';
import { MessageItem } from './MessageItem';
import { ContextMeter } from './ContextMeter';

interface Props {
  activeSession: ChatSession | null;
  messages: ChatMessage[];
  streamState: StreamState;
  streamingMsg: StreamingMessage;
  episodeId?: string;
  onSend: (text: string) => void;
  onAbort: () => void;
  onNew: () => void;
  onFeedback: (msgId: string, value: -1 | 1) => void;
  onFork: (atIdx: number) => void;
}

export function ChatPanel({
  activeSession,
  messages,
  streamState,
  streamingMsg,
  episodeId,
  onSend,
  onAbort,
  onNew,
  onFeedback,
  onFork,
}: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isStreaming = streamState === 'streaming';

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamingMsg.content]);

  // Auto-resize textarea
  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  }

  function submit() {
    const text = input.trim();
    if (!text || isStreaming) return;
    onSend(text);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex flex-col h-full bg-neutral-950/40">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Bot className="w-4 h-4 text-brand-primary flex-shrink-0" />
          <span className="text-sm font-medium text-neutral-200 truncate">
            {activeSession?.title ?? 'Tư vấn AI'}
          </span>
        </div>
        <button
          onClick={onNew}
          title="Phiên mới"
          className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-200 hover:bg-white/10 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Context meter */}
      {activeSession && (
        <ContextMeter tokenCount={activeSession.token_count} />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-4">
        {messages.length === 0 && !isStreaming && (
          <EmptyState onSuggest={onSend} />
        )}

        {messages.map((msg, i) => (
          <MessageItem
            key={msg.id}
            message={msg}
            onFeedback={msg.role === 'assistant' ? (v) => onFeedback(msg.id, v) : undefined}
            onFork={msg.role === 'assistant' ? () => onFork(msg.idx) : undefined}
          />
        ))}

        {/* Streaming bubble */}
        <AnimatePresence>
          {isStreaming && (
            <motion.div
              key="streaming"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-start gap-1"
            >
              {streamingMsg.thinking && (
                <div className="max-w-[85%] px-3 py-1.5 rounded-lg bg-white/5 border border-white/[0.06] text-neutral-500 text-xs italic">
                  {streamingMsg.thinking}
                </div>
              )}
              <div className="max-w-[85%] px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.07] text-sm text-neutral-100 whitespace-pre-wrap leading-relaxed">
                {streamingMsg.content || (
                  <span className="flex items-center gap-1.5 text-neutral-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Đang xử lý...
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-white/[0.06] px-3 py-3">
        <div className="flex items-end gap-2 bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2 focus-within:border-brand-primary/40 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={onKeyDown}
            disabled={isStreaming}
            placeholder={isStreaming ? 'Đang trả lời...' : 'Nhập câu hỏi lâm sàng...'}
            rows={1}
            className="flex-1 bg-transparent resize-none text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none min-h-[24px] max-h-[160px] py-0.5 leading-relaxed disabled:opacity-50"
          />
          {isStreaming ? (
            <button
              onClick={onAbort}
              title="Dừng"
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors mb-0.5"
            >
              <Square className="w-3 h-3" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!input.trim()}
              title="Gửi (Enter)"
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-brand-primary text-white hover:bg-brand-primary/80 disabled:opacity-30 transition-colors mb-0.5"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <p className="text-[10px] text-neutral-700 mt-1.5 text-center">
          Enter gửi — Shift+Enter xuống dòng
        </p>
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  'Tóm tắt lâm sàng ca bệnh này',
  'Giải thích kết quả X-quang',
  'Chẩn đoán phân biệt với tràn dịch màng phổi',
  'Phác đồ điều trị khuyến cáo',
];

function EmptyState({ onSuggest }: { onSuggest: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[240px] gap-4">
      <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center">
        <MessageSquare className="w-5 h-5 text-brand-primary/60" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm text-neutral-300 font-medium">Tư vấn AI lâm sàng</p>
        <p className="text-xs text-neutral-600">Hỏi bất kỳ câu hỏi y tế nào về ca bệnh</p>
      </div>
      <div className="grid grid-cols-1 gap-2 w-full max-w-xs">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSuggest(s)}
            className="text-left text-xs px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-neutral-400 hover:text-neutral-200 hover:border-white/15 hover:bg-white/[0.06] transition-all"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
