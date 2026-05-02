import { Router, Request, Response } from 'express';
import { reporterAgent } from '../agents/reporter.js';
import { authenticateJWT } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { guardrailsMiddleware, validateDraftFields } from '../middleware/guardrails.js';
import { logger } from '../utils/logger.js';
import type { DraftReportRequest, ApiResponse } from '../types/api.js';

const router = Router();

/**
 * POST /api/draft
 * Reporter Agent - Generate draft report from template
 */
router.post(
  '/draft',
  authenticateJWT,
  requirePermission('draft:create'),
  guardrailsMiddleware({ requireCitations: false }), // Citations at field level
  async (req: Request, res: Response) => {
    try {
      const { episode_id, template_id, detection, clinical_data } = req.body as DraftReportRequest;

      // Validation
      if (!episode_id || !template_id || !detection) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Missing required fields: episode_id, template_id, detection',
          },
        });
      }

      logger.info('Draft request received', {
        episode_id,
        template_id,
      });

      // Call Reporter Agent
      const result = await reporterAgent.draft({
        episode_id,
        template_id,
        detection,
        clinical_data,
      });

      // Validate draft fields
      const violations = validateDraftFields(result.fields);
      if (violations.length > 0) {
        logger.warn('Draft field violations detected', { violations });
        return res.status(400).json({
          success: false,
          error: {
            code: violations[0].code,
            message: 'Draft validation failed',
            details: violations,
          },
        });
      }

      const response: ApiResponse<typeof result> = {
        success: true,
        ...result,
      };

      res.json(response);
    } catch (error) {
      logger.error('Draft endpoint error', { error });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate draft report',
          details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
        },
      });
    }
  }
);

export default router;
