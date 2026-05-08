/**
 * Report Version Routes
 *
 * GET    /api/reports/:draftId/versions          – list version history
 * GET    /api/reports/:draftId/versions/:version – get specific version content
 * POST   /api/reports/:draftId/versions          – create new version (save checkpoint)
 * GET    /api/reports/:draftId/lock              – check lock status
 * POST   /api/reports/:draftId/lock              – acquire lock
 * DELETE /api/reports/:draftId/lock              – release lock
 * POST   /api/reports/:draftId/submit            – submit for review
 * POST   /api/reports/:draftId/approve           – approve report
 * POST   /api/reports/:draftId/reject            – reject report
 */

import { Router, type Request, type Response } from 'express';
import { authenticateJWT } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { supabase } from '../lib/supabase/client.js';
import { logger } from '../lib/utils/logger.js';
import {
  createReportVersion,
  getVersionHistory,
  getVersionContent,
} from '../lib/reports/versioning.js';
import { acquireLock, releaseLock, checkLock } from '../lib/reports/lock.js';

const router = Router();

// ── GET /api/reports/:draftId/versions ────────────────────────────────────────
router.get(
  '/:draftId/versions',
  authenticateJWT,
  requirePermission('sessions:read'),
  async (req: Request, res: Response) => {
    const { draftId } = req.params;
    try {
      const versions = await getVersionHistory(draftId);
      return res.json({ success: true, versions });
    } catch (err) {
      return res.status(500).json({ success: false, error: String(err) });
    }
  }
);

// ── GET /api/reports/:draftId/versions/:version ───────────────────────────────
router.get(
  '/:draftId/versions/:version',
  authenticateJWT,
  requirePermission('sessions:read'),
  async (req: Request, res: Response) => {
    const { draftId, version } = req.params;
    try {
      const content = await getVersionContent(draftId, Number(version));
      return res.json({ success: true, version: content });
    } catch (err) {
      return res.status(404).json({ success: false, error: String(err) });
    }
  }
);

// ── POST /api/reports/:draftId/versions ───────────────────────────────────────
router.post(
  '/:draftId/versions',
  authenticateJWT,
  requirePermission('reports:version'),
  async (req: Request, res: Response) => {
    const userId = req.userId!;
    const { draftId } = req.params;
    const { blocks, citation_snapshot, action, action_note, session_id } = req.body as {
      blocks: unknown[];
      citation_snapshot?: unknown[];
      action?: string;
      action_note?: string;
      session_id?: string;
    };

    if (!blocks) {
      return res.status(400).json({ success: false, error: 'blocks bắt buộc' });
    }

    try {
      const version = await createReportVersion({
        draftId,
        blocks,
        citationSnapshot: citation_snapshot ?? [],
        action: (action as any) ?? 'user_edited',
        actionBy: userId,
        actionNote: action_note,
        sessionId: session_id,
      });
      return res.json({ success: true, version });
    } catch (err) {
      return res.status(500).json({ success: false, error: String(err) });
    }
  }
);

// ── GET /api/reports/:draftId/lock ────────────────────────────────────────────
router.get(
  '/:draftId/lock',
  authenticateJWT,
  requirePermission('sessions:read'),
  async (req: Request, res: Response) => {
    const { draftId } = req.params;
    try {
      const status = await checkLock(draftId);
      return res.json({ success: true, lock: status });
    } catch (err) {
      return res.status(500).json({ success: false, error: String(err) });
    }
  }
);

// ── POST /api/reports/:draftId/lock ───────────────────────────────────────────
router.post(
  '/:draftId/lock',
  authenticateJWT,
  requirePermission('reports:version'),
  async (req: Request, res: Response) => {
    const userId = req.userId!;
    const { draftId } = req.params;
    try {
      const status = await acquireLock(draftId, userId);
      if (!status.acquired) {
        return res.status(409).json({ success: false, error: 'Báo cáo đang được chỉnh sửa bởi người khác', lock: status });
      }
      return res.json({ success: true, lock: status });
    } catch (err) {
      return res.status(500).json({ success: false, error: String(err) });
    }
  }
);

// ── DELETE /api/reports/:draftId/lock ─────────────────────────────────────────
router.delete(
  '/:draftId/lock',
  authenticateJWT,
  requirePermission('reports:version'),
  async (req: Request, res: Response) => {
    const userId = req.userId!;
    const { draftId } = req.params;
    try {
      await releaseLock(draftId, userId);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, error: String(err) });
    }
  }
);

// ── POST /api/reports/:draftId/submit ─────────────────────────────────────────
router.post(
  '/:draftId/submit',
  authenticateJWT,
  requirePermission('reports:version'),
  async (req: Request, res: Response) => {
    const userId = req.userId!;
    const { draftId } = req.params;
    const { blocks, citation_snapshot, action_note } = req.body as {
      blocks?: unknown[];
      citation_snapshot?: unknown[];
      action_note?: string;
    };

    // Verify draft exists and is in an editable state
    const { data: draft, error: draftError } = await supabase
      .from('draft_reports')
      .select('draft_id, status, fields')
      .eq('draft_id', draftId)
      .single();

    if (draftError || !draft) {
      return res.status(404).json({ success: false, error: 'Báo cáo không tồn tại' });
    }

    if (!['draft', 'edited', 'rejected'].includes(draft.status)) {
      return res.status(400).json({ success: false, error: `Không thể nộp báo cáo ở trạng thái "${draft.status}"` });
    }

    try {
      // Create a version snapshot if blocks provided
      if (blocks) {
        await createReportVersion({
          draftId,
          blocks,
          citationSnapshot: citation_snapshot ?? [],
          action: 'submitted_for_review',
          actionBy: userId,
          actionNote: action_note,
        });
      }

      // Update draft status
      await supabase
        .from('draft_reports')
        .update({ status: 'under_review' })
        .eq('draft_id', draftId);

      logger.info('[Reports] Submitted for review', { draftId, userId });
      return res.json({ success: true, status: 'under_review' });
    } catch (err) {
      return res.status(500).json({ success: false, error: String(err) });
    }
  }
);

// ── POST /api/reports/:draftId/approve ────────────────────────────────────────
router.post(
  '/:draftId/approve',
  authenticateJWT,
  requirePermission('reports:approve'),
  async (req: Request, res: Response) => {
    const userId = req.userId!;
    const { draftId } = req.params;
    const { action_note } = req.body as { action_note?: string };

    const { data: draft, error: draftError } = await supabase
      .from('draft_reports')
      .select('draft_id, status, fields')
      .eq('draft_id', draftId)
      .single();

    if (draftError || !draft) {
      return res.status(404).json({ success: false, error: 'Báo cáo không tồn tại' });
    }

    if (draft.status !== 'under_review') {
      return res.status(400).json({ success: false, error: 'Chỉ có thể duyệt báo cáo đang chờ xét duyệt' });
    }

    try {
      // Create approved version
      await createReportVersion({
        draftId,
        blocks: draft.fields ?? [],
        citationSnapshot: [],
        action: 'approved',
        actionBy: userId,
        actionNote: action_note,
      });

      await supabase
        .from('draft_reports')
        .update({ status: 'approved' })
        .eq('draft_id', draftId);

      // Release any lock
      await releaseLock(draftId, userId).catch(() => null);

      logger.info('[Reports] Approved', { draftId, userId });
      return res.json({ success: true, status: 'approved' });
    } catch (err) {
      return res.status(500).json({ success: false, error: String(err) });
    }
  }
);

// ── POST /api/reports/:draftId/reject ─────────────────────────────────────────
router.post(
  '/:draftId/reject',
  authenticateJWT,
  requirePermission('reports:approve'),
  async (req: Request, res: Response) => {
    const userId = req.userId!;
    const { draftId } = req.params;
    const { action_note } = req.body as { action_note?: string };

    if (!action_note?.trim()) {
      return res.status(400).json({ success: false, error: 'Lý do từ chối (action_note) bắt buộc' });
    }

    const { data: draft } = await supabase
      .from('draft_reports')
      .select('draft_id, status, fields')
      .eq('draft_id', draftId)
      .single();

    if (!draft || draft.status !== 'under_review') {
      return res.status(400).json({ success: false, error: 'Báo cáo không ở trạng thái chờ xét duyệt' });
    }

    try {
      await createReportVersion({
        draftId,
        blocks: draft.fields ?? [],
        citationSnapshot: [],
        action: 'rejected',
        actionBy: userId,
        actionNote: action_note,
      });

      await supabase
        .from('draft_reports')
        .update({ status: 'rejected' })
        .eq('draft_id', draftId);

      logger.info('[Reports] Rejected', { draftId, userId });
      return res.json({ success: true, status: 'rejected' });
    } catch (err) {
      return res.status(500).json({ success: false, error: String(err) });
    }
  }
);

export default router;
