import { Router, Request, Response } from 'express';
import { explainerAgent } from '../agents/explainer.js';
import { authenticateJWT } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { guardrailsMiddleware } from '../middleware/guardrails.js';
import { logger } from '../utils/logger.js';
import type { ExplainRequest, ApiResponse } from '../types/api.js';

const router = Router();

/**
 * POST /api/explain
 * Explainer Agent - Generate explanation from detection results
 */
router.post(
  '/explain',
  authenticateJWT,
  requirePermission('explain:detection'),
  guardrailsMiddleware({ requireCitations: true }),
  async (req: Request, res: Response) => {
    try {
      const { episode_id, detection, clinical_data } = req.body as ExplainRequest;

      // Validation
      if (!episode_id || !detection || !detection.detections) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Missing required fields: episode_id, detection',
          },
        });
      }

      logger.info('Explain request received', {
        episode_id,
        detectionCount: detection.detections.length,
      });

      // Call Explainer Agent
      const result = await explainerAgent.explain({
        episode_id,
        detection,
        clinical_data,
      });

      const response: ApiResponse<typeof result> = {
        success: true,
        ...result,
      };

      res.json(response);
    } catch (error) {
      logger.error('Explain endpoint error', { error });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate explanation',
          details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
        },
      });
    }
  }
);

export default router;
