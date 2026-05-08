/**
 * useChatSession - Chat Session State Management Hook
 *
 * Handles: session CRUD, message streaming, persistence, feedback
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ChatSession, ChatMessage } from '@/lib/api/sessions';
import {
  listSessions,
  createSession,
  getSession,
  updateSession,
  archiveSession,
  forkSession,
  updateMessageFeedback,
  streamSessionChat,
} from '@/lib/api/sessions';
import type { CitationAnchor } from '@/types/cae-output';

export type StreamState = 'idle' | 'streaming' | 'done' | 'error';

export interface StreamingMessage {
  content: string;
  thinking: string;
  citations: CitationAnchor[];
}

interface UseChatSessionOptions {
  episodeId?: string;
  autoLoad?: boolean;
}

export function useChatSession(options: UseChatSessionOptions = {}) {
  const { episodeId, autoLoad = true } = options;

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamState, setStreamState] = useState<StreamState>('idle');
  const [streamingMsg, setStreamingMsg] = useState<StreamingMessage>({
    content: '',
    thinking: '',
    citations: [],
  });
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);

  const abortRef = useRef<(() => void) | null>(null);

  // ── Load sessions list ──────────────────────────────────────────────────────

  const loadSessions = useCallback(async () => {
    try {
      const { sessions: list } = await listSessions({
        episode_id: episodeId,
        status: 'active',
        limit: 100,
      });
      setSessions(list);
      setSessionsLoaded(true);
    } catch (err) {
      setError('Không tải được danh sách phiên');
    }
  }, [episodeId]);

  useEffect(() => {
    if (autoLoad) loadSessions();
  }, [autoLoad, loadSessions]);

  // ── Switch to a session ─────────────────────────────────────────────────────

  const openSession = useCallback(async (sessionId: string) => {
    setLoadingSessionId(sessionId);
    setError(null);
    try {
      const { session, messages: msgs } = await getSession(sessionId);
      setActiveSession(session);
      setMessages(msgs);
    } catch (err) {
      setError('Không tải được phiên');
    } finally {
      setLoadingSessionId(null);
    }
  }, []);

  // ── New session ─────────────────────────────────────────────────────────────

  const newSession = useCallback(async (title?: string) => {
    try {
      const { session } = await createSession({ episode_id: episodeId, title });
      setSessions((prev) => [session, ...prev]);
      setActiveSession(session);
      setMessages([]);
      return session;
    } catch (err) {
      setError('Không tạo được phiên mới');
      return null;
    }
  }, [episodeId]);

  // ── Rename session ──────────────────────────────────────────────────────────

  const renameSession = useCallback(async (sessionId: string, title: string) => {
    const { session } = await updateSession(sessionId, { title });
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? session : s)));
    if (activeSession?.id === sessionId) setActiveSession(session);
  }, [activeSession]);

  // ── Archive session ─────────────────────────────────────────────────────────

  const deleteSession = useCallback(async (sessionId: string) => {
    await archiveSession(sessionId);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (activeSession?.id === sessionId) {
      setActiveSession(null);
      setMessages([]);
    }
  }, [activeSession]);

  // ── Fork session ────────────────────────────────────────────────────────────

  const fork = useCallback(async (atIdx?: number) => {
    if (!activeSession) return null;
    const title = `${activeSession.title} (rẽ nhánh)`;
    const { session } = await forkSession(activeSession.id, { at_idx: atIdx, title });
    setSessions((prev) => [session, ...prev]);
    await openSession(session.id);
    return session;
  }, [activeSession, openSession]);

  // ── Send message (stream) ───────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    if (streamState === 'streaming') return;
    if (!text.trim()) return;

    // Ensure we have an active session
    let session = activeSession;
    if (!session) {
      const created = await newSession();
      if (!created) return;
      session = created;
    }

    // Optimistic user message
    const optimisticUser: ChatMessage = {
      id: `pending-${Date.now()}`,
      session_id: session.id,
      idx: messages.length,
      role: 'user',
      content: text,
      citations: null,
      model_id: null,
      latency_ms: null,
      token_count: 0,
      is_summarized: false,
      feedback: null,
      feedback_note: null,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticUser]);
    setStreamState('streaming');
    setStreamingMsg({ content: '', thinking: '', citations: [] });
    setError(null);

    const cleanup = streamSessionChat(
      session.id,
      text,
      episodeId,
      (event) => {
        if (event.type === 'thinking') {
          setStreamingMsg((prev) => ({ ...prev, thinking: prev.thinking + (event.delta as string ?? '') }));
        } else if (event.type === 'content') {
          setStreamingMsg((prev) => ({ ...prev, content: prev.content + (event.delta as string ?? '') }));
        } else if (event.type === 'citation') {
          setStreamingMsg((prev) => ({
            ...prev,
            citations: [...prev.citations, event as unknown as CitationAnchor],
          }));
        }
      },
      () => {
        // Done: reload messages from server to get persisted IDs
        setStreamState('done');
        setStreamingMsg({ content: '', thinking: '', citations: [] });
        getSession(session!.id)
          .then(({ messages: msgs, session: updated }) => {
            setMessages(msgs);
            setActiveSession(updated);
            setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
          })
          .catch(() => null);
        abortRef.current = null;
      },
      (err) => {
        setError(err);
        setStreamState('error');
        setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id));
        abortRef.current = null;
      }
    );

    abortRef.current = cleanup;
  }, [streamState, activeSession, messages, episodeId, newSession]);

  // ── Abort stream ────────────────────────────────────────────────────────────

  const abortStream = useCallback(() => {
    abortRef.current?.();
    abortRef.current = null;
    setStreamState('idle');
  }, []);

  // ── Feedback ────────────────────────────────────────────────────────────────

  const giveFeedback = useCallback(async (msgId: string, value: -1 | 0 | 1, note?: string) => {
    if (!activeSession) return;
    await updateMessageFeedback(activeSession.id, msgId, value, note);
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, feedback: value, feedback_note: note ?? null } : m))
    );
  }, [activeSession]);

  return {
    // State
    sessions,
    activeSession,
    messages,
    streamState,
    streamingMsg,
    loadingSessionId,
    error,
    sessionsLoaded,
    // Actions
    loadSessions,
    openSession,
    newSession,
    renameSession,
    deleteSession,
    fork,
    sendMessage,
    abortStream,
    giveFeedback,
  };
}
