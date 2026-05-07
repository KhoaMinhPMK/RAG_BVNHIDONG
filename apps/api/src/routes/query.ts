import { Router, Request, Response } from 'express';
import { knowledgeAgent } from '../agents/knowledge.js';
import { authenticateJWT } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { guardrailsMiddleware } from '../middleware/guardrails.js';
import { logger } from '../utils/logger.js';
import type { QueryRequest, ApiResponse, QueryResponse } from '../types/api.js';
import { saveQueryResult } from '../lib/ai-runs/service.js';

const router = Router();

/**
 * POST /api/query
 * Knowledge Query - RAG retrieval for guideline/SOP
 */
router.post(
  '/query',
  authenticateJWT,
  requirePermission('query:knowledge'),
  guardrailsMiddleware({ requireCitations: true }),
  async (req: Request, res: Response) => {
    try {
      const { query, role, episode_id, provider } = req.body as QueryRequest & { provider?: 'ollama' | 'mimo' };

      // Validation
      if (!query || !role) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Missing required fields: query, role',
          },
        });
      }

      logger.info('Query request received', { query: query.slice(0, 100), role, provider });

      // Abort if client disconnects mid-query
      const ac = new AbortController();
      req.on('close', () => ac.abort());

      // Hard deadline: 45 s for the full 5-step RAG pipeline
      const QUERY_TIMEOUT_MS = Number(process.env.QUERY_TIMEOUT_MS) || 45_000;
      const timeoutId = setTimeout(() => ac.abort(new Error('Query pipeline timeout')), QUERY_TIMEOUT_MS);

      let result;
      try {
        result = await knowledgeAgent.query({
          query,
          role,
          episode_id,
          provider: provider || 'mimo',
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (ac.signal.aborted) {
        // Client already gone or timed out — nothing useful to send back
        return;
      }

      const response: ApiResponse<QueryResponse> = {
        success: true,
        ...result,
      };

      // Persist query result (fire-and-forget)
      void saveQueryResult({
        episode_id: episode_id ?? null,
        query_text: query,
        answer:     result.answer ?? '',
        sources:    result.citations ?? [],
        created_by: req.userId ?? null,
      }).catch((err) => logger.error('saveQueryResult failed', { err }));

      res.json(response);
    } catch (error) {
      logger.error('Query endpoint error', { error });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process query',
          details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
        },
      });
    }
  }
);

export default router;
