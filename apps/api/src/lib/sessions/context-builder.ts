/**
 * Session Context Builder
 *
 * Manages the context window for chat sessions with sliding window + summarization.
 * Prevents token overflow while retaining semantic coherence.
 */

import { supabase } from '../supabase/client.js';
import { logger } from '../utils/logger.js';
import { llmChat } from '../llm/unified.js';

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_TOKENS = 6000;
const SUMMARIZE_THRESHOLD = 0.75; // summarize when above 75% of max
const TOKENS_PER_CHAR = 0.4;      // rough estimate: 1 token ≈ 2.5 chars for Vietnamese

export interface ContextMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ContextWindow {
  messages: ContextMessage[];
  tokenCount: number;
  hadTrimming: boolean;
  summary: string | null;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length * TOKENS_PER_CHAR);
}

/**
 * Build the context window for a session.
 * Returns the most recent messages that fit within the token budget.
 * If the session has a context_summary, it's prepended as a system message.
 */
export async function buildContextWindow(sessionId: string): Promise<ContextWindow> {
  const { data: messages, error } = await supabase
    .from('chat_messages')
    .select('idx, role, content, is_summarized, token_count')
    .eq('session_id', sessionId)
    .order('idx', { ascending: true });

  if (error) {
    logger.error('[ContextBuilder] Failed to load messages', { sessionId, error: error.message });
    return { messages: [], tokenCount: 0, hadTrimming: false, summary: null };
  }

  const { data: session } = await supabase
    .from('chat_sessions')
    .select('context_summary, token_count')
    .eq('id', sessionId)
    .single();

  const existingSummary = session?.context_summary ?? null;

  // Filter out already-summarized messages
  const active = (messages ?? []).filter((m) => !m.is_summarized);

  // Build context window from newest to oldest, up to budget
  let tokenBudget = MAX_TOKENS;
  if (existingSummary) {
    tokenBudget -= estimateTokens(existingSummary) + 50; // 50 for system wrapper
  }

  const selected: ContextMessage[] = [];
  let totalTokens = 0;
  let hadTrimming = false;

  // Iterate from newest, collect until budget exhausted
  for (let i = active.length - 1; i >= 0; i--) {
    const msg = active[i];
    const msgTokens = msg.token_count || estimateTokens(msg.content);
    if (tokenBudget - msgTokens < 0) {
      hadTrimming = true;
      break;
    }
    tokenBudget -= msgTokens;
    totalTokens += msgTokens;
    selected.unshift({ role: msg.role as ContextMessage['role'], content: msg.content });
  }

  return {
    messages: selected,
    tokenCount: totalTokens,
    hadTrimming,
    summary: existingSummary,
  };
}

/**
 * Summarize old turns and mark them as summarized.
 * Called proactively when token_count exceeds SUMMARIZE_THRESHOLD * MAX_TOKENS.
 */
export async function summarizeOldTurns(sessionId: string): Promise<void> {
  const { data: messages } = await supabase
    .from('chat_messages')
    .select('id, idx, role, content, is_summarized')
    .eq('session_id', sessionId)
    .eq('is_summarized', false)
    .order('idx', { ascending: true });

  if (!messages || messages.length < 4) return; // need at least 4 turns to summarize

  // Keep the last 2 turns intact; summarize everything before that
  const toSummarize = messages.slice(0, -4);
  if (toSummarize.length === 0) return;

  const conversationText = toSummarize
    .map((m) => `${m.role === 'user' ? 'Bác sĩ' : 'AI'}: ${m.content}`)
    .join('\n\n');

  try {
    const result = await llmChat(
      [
        {
          role: 'system',
          content:
            'Bạn là AI y tế. Tóm tắt ngắn gọn cuộc hội thoại sau thành 2-3 câu. Giữ lại các điểm y tế quan trọng: chẩn đoán, phát hiện, quyết định điều trị đã được thảo luận. Trả lời bằng tiếng Việt.',
        },
        { role: 'user', content: conversationText },
      ],
      { max_tokens: 256, temperature: 0.3 }
    );

    const summary = result.content.trim();

    // Mark as summarized
    const idsToMark = toSummarize.map((m) => m.id);
    await supabase
      .from('chat_messages')
      .update({ is_summarized: true })
      .in('id', idsToMark);

    // Update session summary
    const { data: session } = await supabase
      .from('chat_sessions')
      .select('context_summary')
      .eq('id', sessionId)
      .single();

    const prevSummary = session?.context_summary;
    const newSummary = prevSummary
      ? `${prevSummary}\n\n[Tiếp theo]: ${summary}`
      : summary;

    await supabase
      .from('chat_sessions')
      .update({ context_summary: newSummary })
      .eq('id', sessionId);

    logger.info('[ContextBuilder] Summarized old turns', {
      sessionId,
      summarizedCount: idsToMark.length,
    });
  } catch (err) {
    logger.error('[ContextBuilder] Summarization failed', { sessionId, error: err });
  }
}

/**
 * Count total tokens for all non-summarized messages and update session.token_count.
 */
export async function refreshSessionTokenCount(sessionId: string): Promise<number> {
  const { data: messages } = await supabase
    .from('chat_messages')
    .select('content, token_count, is_summarized')
    .eq('session_id', sessionId)
    .eq('is_summarized', false);

  const total = (messages ?? []).reduce((sum, m) => {
    return sum + (m.token_count || estimateTokens(m.content));
  }, 0);

  await supabase
    .from('chat_sessions')
    .update({ token_count: total })
    .eq('id', sessionId);

  // Auto-summarize if approaching limit
  if (total > MAX_TOKENS * SUMMARIZE_THRESHOLD) {
    summarizeOldTurns(sessionId).catch(() => null); // fire-and-forget
  }

  return total;
}
