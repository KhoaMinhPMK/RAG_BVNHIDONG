'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, GitBranch, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import type { ChatMessage } from '@/lib/api/sessions';
import type { CitationAnchor } from '@/types/cae-output';

interface Props {
  message: ChatMessage;
  onFeedback?: (value: -1 | 1) => void;
  onFork?: () => void;
}

export function MessageItem({ message, onFeedback, onFork }: Props) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [showThinking, setShowThinking] = useState(false);

  function copyContent() {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`
          max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed
          ${isUser
            ? 'bg-brand-primary/20 text-white border border-brand-primary/25'
            : 'bg-white/[0.06] text-neutral-100 border border-white/[0.07]'}
        `}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        ) : (
          <div className="text-sm leading-relaxed whitespace-pre-wrap text-neutral-100">
            {message.content}
          </div>
        )}

        {/* Citations */}
        {!isUser && message.citations && (message.citations as CitationAnchor[]).length > 0 && (
          <CitationList citations={message.citations as CitationAnchor[]} />
        )}
      </div>

      {/* Action bar (assistant only) */}
      {!isUser && (
        <div className="flex items-center gap-1 px-1">
          <ActionBtn
            title="Hữu ích"
            active={message.feedback === 1}
            onClick={() => onFeedback?.(1)}
            className={message.feedback === 1 ? 'text-green-400' : 'text-neutral-600 hover:text-neutral-300'}
          >
            <ThumbsUp className="w-3 h-3" />
          </ActionBtn>
          <ActionBtn
            title="Không hữu ích"
            active={message.feedback === -1}
            onClick={() => onFeedback?.(-1)}
            className={message.feedback === -1 ? 'text-red-400' : 'text-neutral-600 hover:text-neutral-300'}
          >
            <ThumbsDown className="w-3 h-3" />
          </ActionBtn>
          <ActionBtn title="Sao chép" onClick={copyContent} className="text-neutral-600 hover:text-neutral-300">
            {copied ? <span className="text-[10px] text-green-400">Đã chép</span> : <Copy className="w-3 h-3" />}
          </ActionBtn>
          {onFork && (
            <ActionBtn title="Rẽ nhánh từ đây" onClick={onFork} className="text-neutral-600 hover:text-neutral-300">
              <GitBranch className="w-3 h-3" />
            </ActionBtn>
          )}
          {message.latency_ms && (
            <span className="text-[10px] text-neutral-700 ml-1">{(message.latency_ms / 1000).toFixed(1)}s</span>
          )}
        </div>
      )}
    </div>
  );
}

function CitationList({ citations }: { citations: CitationAnchor[] }) {
  const [open, setOpen] = useState(false);
  if (citations.length === 0) return null;

  return (
    <div className="mt-2 pt-2 border-t border-white/10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
      >
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {citations.length} trích dẫn
      </button>
      {open && (
        <ol className="mt-1.5 space-y-1.5 pl-0">
          {citations.map((c, i) => (
            <li key={i} className="flex gap-2 text-[11px] text-neutral-400">
              <span className="flex-shrink-0 w-4 h-4 rounded-full bg-white/10 text-center text-[10px] leading-4 font-mono">
                {i + 1}
              </span>
              <span>
                <span className="font-medium text-neutral-300">{(c as any).document_title ?? 'Tài liệu'}</span>
                {(c as any).excerpt && (
                  <span className="block text-neutral-600 line-clamp-2">{(c as any).excerpt}</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ActionBtn({
  children,
  title,
  active,
  className,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  active?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`p-1 rounded transition-colors ${className ?? ''}`}
    >
      {children}
    </button>
  );
}
