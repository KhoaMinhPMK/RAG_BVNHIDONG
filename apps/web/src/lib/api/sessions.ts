/**
 * Sessions & Reports API Client
 * Frontend fetch wrappers for /api/sessions and /api/reports
 */

import { API_BASE_URL, getAuthToken } from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatSession {
  id: string;
  user_id: string;
  episode_id: string | null;
  title: string;
  status: 'active' | 'archived';
  forked_from_id: string | null;
  forked_at_idx: number | null;
  context_summary: string | null;
  token_count: number;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  idx: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations: unknown[] | null;
  model_id: string | null;
  latency_ms: number | null;
  token_count: number;
  is_summarized: boolean;
  feedback: -1 | 0 | 1 | null;
  feedback_note: string | null;
  created_at: string;
}

export interface ReportVersion {
  id: string;
  draft_id: string;
  version: number;
  blocks: unknown[];
  citation_snapshot: unknown[];
  action: string;
  action_by: string | null;
  action_note: string | null;
  model_id: string | null;
  created_at: string;
}

export interface LockStatus {
  acquired: boolean;
  lockedBy: string | null;
  expiresAt: string | null;
}

// ── Helper ────────────────────────────────────────────────────────────────────

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string> || {}) },
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data as T;
}

// ── Sessions API ──────────────────────────────────────────────────────────────

export async function listSessions(params?: {
  episode_id?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ sessions: ChatSession[] }> {
  const qs = new URLSearchParams();
  if (params?.episode_id) qs.set('episode_id', params.episode_id);
  if (params?.status) qs.set('status', params.status);
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.offset) qs.set('offset', String(params.offset));
  const query = qs.toString() ? `?${qs}` : '';
  return apiFetch(`/api/sessions${query}`);
}

export async function createSession(params: {
  episode_id?: string;
  title?: string;
}): Promise<{ session: ChatSession }> {
  return apiFetch('/api/sessions', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function getSession(id: string): Promise<{ session: ChatSession; messages: ChatMessage[] }> {
  return apiFetch(`/api/sessions/${id}`);
}

export async function updateSession(id: string, updates: { title?: string; status?: string }): Promise<{ session: ChatSession }> {
  return apiFetch(`/api/sessions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function archiveSession(id: string): Promise<void> {
  await apiFetch(`/api/sessions/${id}`, { method: 'DELETE' });
}

export async function forkSession(id: string, params: { at_idx?: number; title?: string }): Promise<{ session: ChatSession }> {
  return apiFetch(`/api/sessions/${id}/fork`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function updateMessageFeedback(
  sessionId: string,
  msgId: string,
  feedback: -1 | 0 | 1,
  feedbackNote?: string
): Promise<void> {
  await apiFetch(`/api/sessions/${sessionId}/messages/${msgId}`, {
    method: 'PATCH',
    body: JSON.stringify({ feedback, feedback_note: feedbackNote }),
  });
}

// ── Reports API ───────────────────────────────────────────────────────────────

export async function getVersionHistory(draftId: string): Promise<{ versions: ReportVersion[] }> {
  return apiFetch(`/api/reports/${draftId}/versions`);
}

export async function getVersionContent(draftId: string, version: number): Promise<{ version: ReportVersion }> {
  return apiFetch(`/api/reports/${draftId}/versions/${version}`);
}

export async function saveVersion(draftId: string, params: {
  blocks: unknown[];
  citation_snapshot?: unknown[];
  action?: string;
  action_note?: string;
  session_id?: string;
}): Promise<{ version: number }> {
  return apiFetch(`/api/reports/${draftId}/versions`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function checkLock(draftId: string): Promise<{ lock: LockStatus }> {
  return apiFetch(`/api/reports/${draftId}/lock`);
}

export async function acquireLock(draftId: string): Promise<{ lock: LockStatus }> {
  return apiFetch(`/api/reports/${draftId}/lock`, { method: 'POST' });
}

export async function releaseLock(draftId: string): Promise<void> {
  await apiFetch(`/api/reports/${draftId}/lock`, { method: 'DELETE' });
}

export async function submitReport(draftId: string, params?: {
  blocks?: unknown[];
  citation_snapshot?: unknown[];
  action_note?: string;
}): Promise<{ status: string }> {
  return apiFetch(`/api/reports/${draftId}/submit`, {
    method: 'POST',
    body: JSON.stringify(params ?? {}),
  });
}

export async function approveReport(draftId: string, actionNote?: string): Promise<{ status: string }> {
  return apiFetch(`/api/reports/${draftId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ action_note: actionNote }),
  });
}

export async function rejectReport(draftId: string, actionNote: string): Promise<{ status: string }> {
  return apiFetch(`/api/reports/${draftId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ action_note: actionNote }),
  });
}

// ── Streaming helper ──────────────────────────────────────────────────────────

/**
 * Open an SSE stream for session chat.
 * Returns cleanup function.
 */
export function streamSessionChat(
  sessionId: string,
  userMessage: string,
  episodeId: string | undefined,
  onEvent: (event: { type: string; [key: string]: unknown }) => void,
  onDone: () => void,
  onError: (err: string) => void
): () => void {
  let aborted = false;

  getAuthToken().then((token) => {
    if (aborted) return;

    fetch(`${API_BASE_URL}/api/sessions/${sessionId}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        user_message: userMessage,
        episode_id: episodeId,
      }),
    }).then(async (res) => {
      if (!res.ok || !res.body) {
        onError(`HTTP ${res.status}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done || aborted) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              onEvent(parsed);
              if (parsed.type === 'done') onDone();
              if (parsed.type === 'error') onError(parsed.message ?? 'Lỗi không xác định');
            } catch {
              // malformed line, skip
            }
          }
        }
      }
    }).catch((err) => onError(String(err)));
  });

  return () => { aborted = true; };
}
