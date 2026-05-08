/**
 * Chat Session Routes
 *
 * GET    /api/sessions                     – list user's sessions (paginated)
 * POST   /api/sessions                     – create session
 * GET    /api/sessions/:id                 – get session + messages
 * PATCH  /api/sessions/:id                 – update title / status
 * DELETE /api/sessions/:id                 – archive session
 * POST   /api/sessions/:id/messages        – append message(s)
 * POST   /api/sessions/:id/fork            – fork from a specific message index
 * GET    /api/sessions/:id/messages        – paginated message list
 * PATCH  /api/sessions/:id/messages/:msgId – update feedback on a message
 * POST   /api/sessions/:id/stream          – SSE: chat stream that persists to session
 */

import { Router, type Request, type Response } from 'express';
import { authenticateJWT } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { supabase } from '../lib/supabase/client.js';
import { logger } from '../lib/utils/logger.js';
import { streamChat } from '../agents/cae.js';
import { sseHeaders } from '../agents/cae.js';
import { generateSessionTitle } from '../lib/sessions/auto-title.js';
import { buildContextWindow, refreshSessionTokenCount } from '../lib/sessions/context-builder.js';
import { createRun, completeRun, failRun, abortRun } from '../lib/ai-runs/service.js';
import type { AiRunBlock } from '../lib/ai-runs/service.js';

const router = Router();

// ── GET /api/sessions ─────────────────────────────────────────────────────────
router.get(
  '/',
  authenticateJWT,
  requirePermission('sessions:read'),
  async (req: Request, res: Response) => {
    const userId = req.userId!;
    const { episode_id, status, limit = '50', offset = '0' } = req.query as Record<string, string>;

    let query = supabase
      .from('chat_sessions')
      .select('id, title, status, episode_id, token_count, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (episode_id) query = query.eq('episode_id', episode_id);
    if (status) query = query.eq('status', status);
    else query = query.eq('status', 'active');

    const { data, error } = await query;
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true, sessions: data ?? [] });
  }
);

// ── POST /api/sessions ────────────────────────────────────────────────────────
router.post(
  '/',
  authenticateJWT,
  requirePermission('sessions:write'),
  async (req: Request, res: Response) => {
    const userId = req.userId!;
    const { episode_id, title } = req.body as { episode_id?: string; title?: string };

    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: userId,
        episode_id: episode_id ?? null,
        title: title || 'Phiên mới',
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.status(201).json({ success: true, session: data });
  }
);

// ── GET /api/sessions/:id ─────────────────────────────────────────────────────
router.get(
  '/:id',
  authenticateJWT,
  requirePermission('sessions:read'),
  async (req: Request, res: Response) => {
    const userId = req.userId!;
    const { id } = req.params;

    const { data: session, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !session) {
      return res.status(404).json({ success: false, error: 'Phiên không tồn tại' });
    }

    const { data: messages } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', id)
      .order('idx', { ascending: true });

    return res.json({ success: true, session, messages: messages ?? [] });
  }
);

// ── PATCH /api/sessions/:id ───────────────────────────────────────────────────
router.patch(
  '/:id',
  authenticateJWT,
  requirePermission('sessions:write'),
  async (req: Request, res: Response) => {
    const userId = req.userId!;
    const { id } = req.params;
    const { title, status } = req.body as { title?: string; status?: string };

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title.slice(0, 80);
    if (status === 'archived' || status === 'active') updates.status = status;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'Không có trường nào để cập nhật' });
    }

    const { data, error } = await supabase
      .from('chat_sessions')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Phiên không tồn tại hoặc lỗi cập nhật' });
    }

    return res.json({ success: true, session: data });
  }
);

// ── DELETE /api/sessions/:id ──────────────────────────────────────────────────
router.delete(
  '/:id',
  authenticateJWT,
  requirePermission('sessions:write'),
  async (req: Request, res: Response) => {
    const userId = req.userId!;
    const { id } = req.params;

    // Soft-delete: archive instead of removing
    const { error } = await supabase
      .from('chat_sessions')
      .update({ status: 'archived' })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true });
  }
);

// ── GET /api/sessions/:id/messages ────────────────────────────────────────────
router.get(
  '/:id/messages',
  authenticateJWT,
  requirePermission('sessions:read'),
  async (req: Request, res: Response) => {
    const userId = req.userId!;
    const { id } = req.params;
    const { limit = '100', offset = '0' } = req.query as Record<string, string>;

    // Verify ownership
    const { data: session } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!session) {
      return res.status(404).json({ success: false, error: 'Phiên không tồn tại' });
    }

    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', id)
      .order('idx', { ascending: true })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true, messages: messages ?? [] });
  }
);

// ── POST /api/sessions/:id/messages ──────────────────────────────────────────
router.post(
  '/:id/messages',
  authenticateJWT,
  requirePermission('sessions:write'),
  async (req: Request, res: Response) => {
    const userId = req.userId!;
    const { id } = req.params;
    const { role, content } = req.body as { role: 'user' | 'assistant'; content: string };

    if (!role || !content) {
      return res.status(400).json({ success: false, error: 'role và content bắt buộc' });
    }

    // Verify ownership
    const { data: session } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!session) {
      return res.status(404).json({ success: false, error: 'Phiên không tồn tại' });
    }

    // Get next idx
    const { count } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', id);

    const nextIdx = count ?? 0;

    const { data: message, error } = await supabase
      .from('chat_messages')
      .insert({ session_id: id, idx: nextIdx, role, content })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.status(201).json({ success: true, message });
  }
);

// ── PATCH /api/sessions/:id/messages/:msgId ────────────────────────────────────
router.patch(
  '/:id/messages/:msgId',
  authenticateJWT,
  requirePermission('sessions:write'),
  async (req: Request, res: Response) => {
    const userId = req.userId!;
    const { id, msgId } = req.params;
    const { feedback, feedback_note } = req.body as { feedback?: -1 | 0 | 1; feedback_note?: string };

    // Verify session ownership
    const { data: session } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!session) {
      return res.status(404).json({ success: false, error: 'Phiên không tồn tại' });
    }

    const updates: Record<string, unknown> = {};
    if (feedback !== undefined) updates.feedback = feedback;
    if (feedback_note !== undefined) updates.feedback_note = feedback_note;

    const { data, error } = await supabase
      .from('chat_messages')
      .update(updates)
      .eq('id', msgId)
      .eq('session_id', id)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Tin nhắn không tồn tại' });
    }

    return res.json({ success: true, message: data });
  }
);

// ── POST /api/sessions/:id/fork ───────────────────────────────────────────────
router.post(
  '/:id/fork',
  authenticateJWT,
  requirePermission('sessions:write'),
  async (req: Request, res: Response) => {
    const userId = req.userId!;
    const { id } = req.params;
    const { at_idx, title } = req.body as { at_idx?: number; title?: string };

    // Verify ownership
    const { data: parent } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!parent) {
      return res.status(404).json({ success: false, error: 'Phiên gốc không tồn tại' });
    }

    // Get messages up to fork point
    let msgQuery = supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', id)
      .order('idx', { ascending: true });

    if (at_idx !== undefined) {
      msgQuery = msgQuery.lte('idx', at_idx);
    }

    const { data: messages } = await msgQuery;

    // Create new session
    const { data: newSession, error: sessErr } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: userId,
        episode_id: parent.episode_id,
        title: title || `${parent.title} (rẽ nhánh)`,
        status: 'active',
        forked_from_id: id,
        forked_at_idx: at_idx ?? null,
        context_summary: parent.context_summary,
      })
      .select()
      .single();

    if (sessErr || !newSession) {
      return res.status(500).json({ success: false, error: 'Không thể tạo phiên rẽ nhánh' });
    }

    // Copy messages
    if (messages && messages.length > 0) {
      const toInsert = messages.map((m, i) => ({
        session_id: newSession.id,
        idx: i,
        role: m.role,
        content: m.content,
        citations: m.citations,
        model_id: m.model_id,
        token_count: m.token_count,
      }));

      await supabase.from('chat_messages').insert(toInsert as any);
    }

    return res.status(201).json({ success: true, session: newSession });
  }
);

// ── POST /api/sessions/:id/stream ─────────────────────────────────────────────
// SSE endpoint: stream a chat response and persist user + assistant messages
router.post(
  '/:id/stream',
  authenticateJWT,
  requirePermission('sessions:write'),
  async (req: Request, res: Response) => {
    const userId = req.userId!;
    const { id } = req.params;
    const { user_message, episode_id, finding_ids } = req.body as {
      user_message: string;
      episode_id?: string;
      finding_ids?: string[];
    };

    if (!user_message?.trim()) {
      return res.status(400).json({ success: false, error: 'user_message bắt buộc' });
    }

    // Verify session ownership
    const { data: session } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!session) {
      return res.status(404).json({ success: false, error: 'Phiên không tồn tại' });
    }

    const resolvedEpisodeId = episode_id ?? session.episode_id ?? '';

    // Build context window
    const contextWindow = await buildContextWindow(id);

    // Append user message to DB (get next idx first)
    const { count: msgCount } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', id);

    const userIdx = msgCount ?? 0;
    const { data: userMsg } = await supabase
      .from('chat_messages')
      .insert({ session_id: id, idx: userIdx, role: 'user', content: user_message })
      .select()
      .single();

    // Auto-title on first message
    if (userIdx === 0 && session.title === 'Phiên mới') {
      generateSessionTitle(user_message)
        .then((title) =>
          supabase.from('chat_sessions').update({ title }).eq('id', id)
        )
        .catch(() => null);
    }

    // Build message history for CAE agent
    const historyMessages = contextWindow.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    historyMessages.push({ role: 'user', content: user_message });

    // Create ai_run record
    const run_id = await createRun({
      episode_id: resolvedEpisodeId,
      run_type: 'chat',
      finding_ids,
      created_by: userId,
    });

    const disconnectAc = new AbortController();
    let streamFinished = false;
    const collectedBlocks: AiRunBlock[] = [];
    let collectedContent = '';
    let citationsAccumulated: unknown[] = [];

    req.on('close', () => {
      if (!streamFinished && run_id) void abortRun(run_id, collectedBlocks);
      disconnectAc.abort();
    });

    try {
      await streamChat(resolvedEpisodeId, historyMessages, res, {
        findingIds: finding_ids,
        runId: run_id ?? undefined,
        signal: disconnectAc.signal,
        onBlock: (block: AiRunBlock) => { collectedBlocks.push(block); },
        onContent: (text: string) => { collectedContent += text; },
        onCitations: (citations: unknown[]) => { citationsAccumulated = citations; },
      });

      streamFinished = true;
      if (run_id) {
        await completeRun(run_id, {
          blocks: collectedBlocks,
          raw_content: collectedContent,
          citations: citationsAccumulated,
        });
      }

      // Persist assistant message
      const assistantIdx = userIdx + 1;
      await supabase.from('chat_messages').insert({
        session_id: id,
        idx: assistantIdx,
        role: 'assistant',
        content: collectedContent,
        citations: citationsAccumulated as any,
      });

      // Refresh token count (async)
      refreshSessionTokenCount(id).catch(() => null);

      logger.info('[Sessions] stream complete', { sessionId: id, run_id });
    } catch (err) {
      streamFinished = true;
      if (run_id) await failRun(run_id, err instanceof Error ? err.message : 'stream failed');
      if (!res.writableEnded) {
        res.status(500).json({ success: false, error: 'Lỗi phát sinh trong quá trình stream' });
      }
    }
  }
);

export default router;
