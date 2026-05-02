import { Router, Request, Response } from 'express';
import { knowledgeAgent } from '../agents/knowledge.js';
import { authenticateJWT } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { guardrailsMiddleware } from '../middleware/guardrails.js';
import { logger } from '../utils/logger.js';
import type { QueryRequest, ApiResponse, QueryResponse } from '../types/api.js';

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
      const { query, role, episode_id } = req.body as QueryRequest;

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

      logger.info('Query request received', { query: query.slice(0, 100), role });

      // Call Knowledge Agent
      const result = await knowledgeAgent.query({
        query,
        role,
        episode_id,
      });

      const response: ApiResponse<QueryResponse> = {
        success: true,
        ...result,
      };

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
