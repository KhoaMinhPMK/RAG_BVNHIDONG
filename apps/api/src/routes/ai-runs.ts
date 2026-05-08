/**
 * AI Runs Routes
 *
 * GET  /api/ai-runs?episode_id=&type=&limit=  – list runs (metadata)
 * GET  /api/ai-runs/latest?episode_id=&type=  – latest completed run with full content
 * GET  /api/ai-runs/:run_id                   – single run by ID
 * POST /api/ai-runs/:run_id/abort             – mark a streaming run aborted (client disconnect)
 *
 * GET  /api/drafts                            – list all drafts (paginated)
 * GET  /api/drafts/latest?episode_id=         – latest draft for episode
 * GET  /api/drafts/:draft_id                  – get draft with signature info
 * POST /api/drafts/:draft_id/approve          – approve draft + e-signature
 */

import { Router, type Request, type Response } from 'express';
import { authenticateJWT } from '../middleware/auth.js';
import {
  getLatestRun, getRunHistory, getRunById, abortRun,
  approveDraft,
} from '../lib/ai-runs/service.js';
import { supabase } from '../lib/supabase/client.js';
import { logger } from '../utils/logger.js';

const router = Router();

// ── GET /api/ai-runs ────────────────────────────────────────────────────────

router.get('/', authenticateJWT, async (req: Request, res: Response) => {
  const { episode_id, type, limit } = req.query as Record<string, string>;

  if (!episode_id) {
    return res.status(400).json({ success: false, error: 'episode_id required' });
  }

  const runs = await getRunHistory(
    episode_id,
    type as Parameters<typeof getRunHistory>[1],
    limit ? Math.min(Number(limit), 50) : 20
  );

  return res.json({ success: true, runs });
});

// ── GET /api/ai-runs/latest ─────────────────────────────────────────────────

router.get('/latest', authenticateJWT, async (req: Request, res: Response) => {
  const { episode_id, type, max_age_min } = req.query as Record<string, string>;

  if (!episode_id || !type) {
    return res.status(400).json({ success: false, error: 'episode_id and type required' });
  }

  const maxAgeMs = max_age_min ? Number(max_age_min) * 60_000 : 30 * 60_000;

  const run = await getLatestRun(
    episode_id,
    type as Parameters<typeof getLatestRun>[1],
    maxAgeMs
  );

  // Return 200+null (not 404) so frontend doesn't get console noise on cache miss
  return res.json({ success: true, run: run ?? null });
});

// ── GET /api/ai-runs/:run_id ────────────────────────────────────────────────

router.get('/:run_id', authenticateJWT, async (req: Request, res: Response) => {
  const { run_id } = req.params;

  const run = await getRunById(run_id);
  if (!run) {
    return res.status(404).json({ success: false, error: 'Run not found' });
  }

  return res.json({ success: true, run });
});

// ── POST /api/ai-runs/:run_id/abort ────────────────────────────────────────

router.post('/:run_id/abort', authenticateJWT, async (req: Request, res: Response) => {
  const { run_id } = req.params;
  await abortRun(run_id);
  return res.json({ success: true });
});

// ── GET /api/drafts?status=&limit=&offset= ────────────────────────────────
// List all drafts across episodes (for the reports page)
router.get('/drafts', authenticateJWT, async (req: Request, res: Response) => {
  const { status, limit = '50', offset = '0' } = req.query as Record<string, string>;

  let query = supabase
    .from('draft_reports')
    .select(`
      draft_id, episode_id, template_id, status, model_version,
      created_by, approved_by, created_at, updated_at
    `, { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error, count } = await query;

  if (error) {
    logger.warn('[drafts] list query error', { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }

  return res.json({ success: true, drafts: data ?? [], total: count ?? 0 });
});

// ── GET /api/drafts/latest?episode_id= ────────────────────────────────────

router.get('/drafts/latest', authenticateJWT, async (req: Request, res: Response) => {
  const { episode_id } = req.query as Record<string, string>;

  if (!episode_id) {
    return res.status(400).json({ success: false, error: 'episode_id required' });
  }

  const { data, error } = await supabase
    .from('draft_reports')
    .select(`
      draft_id, episode_id, template_id, fields, status, model_version,
      created_by, approved_by, created_at, updated_at
    `)
    .eq('episode_id', episode_id)
    .in('status', ['draft', 'under_review', 'edited', 'approved'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    logger.warn('[drafts/latest] query error', { error: error.message });
  }
  return res.json({ success: true, draft: data ?? null });
});

// ── GET /api/drafts/:draft_id ───────────────────────────────────────────────

router.get('/drafts/:draft_id', authenticateJWT, async (req: Request, res: Response) => {
  const { draft_id } = req.params;

  const { data, error } = await supabase
    .from('draft_reports')
    .select(`
      draft_id, episode_id, template_id, fields, status, model_version,
      created_by, approved_by, created_at, updated_at
    `)
    .eq('draft_id', draft_id)
    .single();

  if (error || !data) {
    return res.status(404).json({ success: false, error: 'Draft not found' });
  }

  return res.json({ success: true, draft: data });
});

// ── POST /api/drafts/:draft_id/approve ─────────────────────────────────────

router.post('/drafts/:draft_id/approve', authenticateJWT, async (req: Request, res: Response) => {
  const { draft_id } = req.params;
  const userId = req.userId;

  const {
    approval_note,
    signature_name,    // full name typed by doctor
  } = req.body as {
    approval_note?: string;
    signature_name?: string;
  };

  if (!signature_name?.trim()) {
    return res.status(400).json({
      success: false,
      error: 'signature_name required — doctor must type their full name to confirm',
    });
  }

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Authenticated user required' });
  }

  const signature = {
    method:    'typed_name' as const,
    name:      signature_name.trim(),
    user_id:   userId,
    timestamp: new Date().toISOString(),
    ip:        req.ip ?? 'unknown',
  };

  const result = await approveDraft({
    draft_id,
    approved_by:   userId,
    approval_note,
    signature,
  });

  if (!result.ok) {
    logger.warn('[drafts] approve failed', { draft_id, error: result.error });
    return res.status(400).json({ success: false, error: result.error });
  }

  logger.info('[drafts] approved', { draft_id, approved_by: userId });

  return res.json({
    success: true,
    draft_id,
    approved_at: signature.timestamp,
    signature,
  });
});

export default router;
