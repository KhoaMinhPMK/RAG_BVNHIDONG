/**
 * CAE Routes
 * POST /api/cae/brief  → SSE: auto briefing khi mở case
 * POST /api/cae/chat   → SSE: multi-turn chat
 * POST /api/cae/explain → SSE: structured explain workflow
 * POST /api/cae/draft   → SSE: structured draft workflow
 * POST /api/cae/tts    → audio/mpeg: TTS
 */

import { Router, type Request, type Response } from 'express';
import { authenticateJWT } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { guardrailsMiddleware } from '../middleware/guardrails.js';
import { streamBrief, streamChat, streamExplain, streamDraft } from '../agents/cae.js';
import { getMiMoClient } from '../lib/mimo/client.js';
import { logger } from '../lib/utils/logger.js';
import { createRun, completeRun, failRun, abortRun } from '../lib/ai-runs/service.js';
import type { AiRunBlock } from '../lib/ai-runs/service.js';

const router = Router();

router.post('/brief', authenticateJWT, async (req: Request, res: Response) => {
  const { episode_id, finding_ids } = req.body as {
    episode_id?: string;
    finding_ids?: string[];
  };

  if (!episode_id) {
    return res.status(400).json({ success: false, error: 'episode_id required' });
  }

  const userId = req.userId;
  logger.info('[CAE] /brief', { episode_id, user: userId });

  // Create persistence run record
  const run_id = await createRun({
    episode_id, run_type: 'brief',
    finding_ids, created_by: userId ?? undefined,
  });

  let streamFinished = false;
  req.on('close', () => {
    // Only abort if stream hasn't finished — avoids overwriting completed runs
    // (req 'close' fires on normal connection end too, not just client disconnect)
    if (!streamFinished && run_id) void abortRun(run_id, collectedBlocks);
  });

  const collectedBlocks: AiRunBlock[] = [];
  let collectedContent = '';

  try {
    await streamBrief(episode_id, res, {
      findingIds: finding_ids,
      runId: run_id ?? undefined,
      onBlock: (block: AiRunBlock) => { collectedBlocks.push(block); },
      onContent: (text: string) => { collectedContent += text; },
    });
    streamFinished = true;
    if (run_id) {
      await completeRun(run_id, {
        blocks: collectedBlocks, raw_content: collectedContent, citations: [],
      });
    }
  } catch (err) {
    streamFinished = true;
    if (run_id) await failRun(run_id, err instanceof Error ? err.message : 'brief failed');
    if (!res.writableEnded) {
      res.status(500).json({ success: false, error: 'CAE brief failed' });
    }
  }
});

router.post('/chat', authenticateJWT, async (req: Request, res: Response) => {
  const { episode_id, messages, finding_ids } = req.body as {
    episode_id?: string;
    messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
    finding_ids?: string[];
  };

  if (!episode_id) {
    return res.status(400).json({ success: false, error: 'episode_id required' });
  }

  const userId = req.userId;
  logger.info('[CAE] /chat', { episode_id, msgCount: messages?.length ?? 0 });

  const run_id = await createRun({
    episode_id, run_type: 'chat',
    finding_ids, created_by: userId ?? undefined,
  });

  let streamFinished = false;
  const collectedBlocks: AiRunBlock[] = [];
  let collectedContent = '';
  req.on('close', () => {
    if (!streamFinished && run_id) void abortRun(run_id, collectedBlocks);
  });

  try {
    await streamChat(episode_id, messages || [], res, {
      findingIds: finding_ids,
      runId: run_id ?? undefined,
      onBlock: (block: AiRunBlock) => { collectedBlocks.push(block); },
      onContent: (text: string) => { collectedContent += text; },
    });
    streamFinished = true;
    if (run_id) {
      await completeRun(run_id, { blocks: collectedBlocks, raw_content: collectedContent, citations: [] });
    }
  } catch (err) {
    streamFinished = true;
    if (run_id) await failRun(run_id, err instanceof Error ? err.message : 'chat failed');
    if (!res.writableEnded) {
      res.status(500).json({ success: false, error: 'CAE chat failed' });
    }
  }
});

router.post(
  '/explain',
  authenticateJWT,
  requirePermission('explain:detection'),
  guardrailsMiddleware({ requireCitations: true }),
  async (req: Request, res: Response) => {
    const { episode_id, detection, clinical_data, finding_ids } = req.body as {
      episode_id?: string;
      detection?: {
        image_id: string;
        detections: Array<{
          bbox: [number, number, number, number];
          label: string;
          score: number;
        }>;
        model_version?: string;
        timestamp?: string;
      };
      clinical_data?: Record<string, unknown>;
      finding_ids?: string[];
    };

    if (!episode_id || !detection?.detections) {
      return res.status(400).json({ success: false, error: 'episode_id and detection required' });
    }

    const userId = req.userId;
    logger.info('[CAE] /explain', { episode_id, detectionCount: detection.detections.length });

    const run_id = await createRun({
      episode_id, run_type: 'explain',
      finding_ids, created_by: userId ?? undefined,
    });

    let streamFinished = false;
    const collectedBlocks: AiRunBlock[] = [];
    let collectedContent = '';
    const collectedCitations: unknown[] = [];
    req.on('close', () => {
      if (!streamFinished && run_id) void abortRun(run_id, collectedBlocks);
    });

    try {
      await streamExplain(episode_id, detection, res, {
        clinicalData: clinical_data,
        findingIds: finding_ids,
        runId: run_id ?? undefined,
        onBlock: (block: AiRunBlock) => { collectedBlocks.push(block); },
        onContent: (text: string) => { collectedContent += text; },
        onCitations: (cits: unknown[]) => { collectedCitations.push(...cits); },
      });
      streamFinished = true;
      if (run_id) {
        await completeRun(run_id, {
          blocks: collectedBlocks, raw_content: collectedContent, citations: collectedCitations,
        });
      }
    } catch (err) {
      streamFinished = true;
      if (run_id) await failRun(run_id, err instanceof Error ? err.message : 'explain failed');
      if (!res.writableEnded) {
        res.status(500).json({ success: false, error: 'CAE explain failed' });
      }
    }
  }
);

router.post(
  '/draft',
  authenticateJWT,
  requirePermission('draft:create'),
  guardrailsMiddleware({ requireCitations: false }),
  async (req: Request, res: Response) => {
    const { episode_id, template_id, detection, clinical_data, finding_ids } = req.body as {
      episode_id?: string;
      template_id?: string;
      detection?: {
        image_id: string;
        detections: Array<{
          bbox: [number, number, number, number];
          label: string;
          score: number;
        }>;
        model_version?: string;
        timestamp?: string;
      };
      clinical_data?: Record<string, unknown>;
      finding_ids?: string[];
    };

    if (!episode_id || !template_id || !detection) {
      return res.status(400).json({ success: false, error: 'episode_id, template_id and detection required' });
    }

    const userId = req.userId;
    logger.info('[CAE] /draft', { episode_id, template_id, detectionCount: detection.detections.length });

    const run_id = await createRun({
      episode_id, run_type: 'draft',
      finding_ids, created_by: userId ?? undefined,
    });

    let streamFinished = false;
    const collectedBlocks: AiRunBlock[] = [];
    let collectedContent = '';
    const collectedCitations: unknown[] = [];
    let draftRef: string | undefined;
    req.on('close', () => {
      if (!streamFinished && run_id) void abortRun(run_id, collectedBlocks);
    });

    try {
      await streamDraft(episode_id, template_id, detection, res, {
        clinicalData: clinical_data,
        findingIds: finding_ids,
        runId: run_id ?? undefined,
        onBlock: (block: AiRunBlock) => { collectedBlocks.push(block); },
        onContent: (text: string) => { collectedContent += text; },
        onCitations: (cits: unknown[]) => { collectedCitations.push(...cits); },
        onDraftSaved: (draft_id: string) => { draftRef = draft_id; },
      });
      streamFinished = true;
      if (run_id) {
        await completeRun(run_id, {
          blocks: collectedBlocks, raw_content: collectedContent,
          citations: collectedCitations, draft_ref: draftRef,
        });
      }
    } catch (err) {
      streamFinished = true;
      if (run_id) await failRun(run_id, err instanceof Error ? err.message : 'draft failed');
      if (!res.writableEnded) {
        res.status(500).json({ success: false, error: 'CAE draft failed' });
      }
    }
  }
);

router.post('/tts', authenticateJWT, async (req: Request, res: Response) => {
  const { text, voice } = req.body as { text?: string; voice?: string };

  if (!text?.trim()) {
    return res.status(400).json({ success: false, error: 'text required' });
  }

  const safeText = text.slice(0, 2000);

  try {
    const mimo = getMiMoClient();
    const audioBuffer = await mimo.textToSpeech(safeText, voice || 'Mia');

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length);
    res.send(audioBuffer);
  } catch (err) {
    logger.error('[CAE] TTS error', { error: err });
    res.status(500).json({ success: false, error: 'TTS failed' });
  }
});

export default router;