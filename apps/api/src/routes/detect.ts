import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase/client.js';
import { authenticateJWT } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { logger } from '../utils/logger.js';
import type { ApiResponse, DetectionStatusResponse } from '../types/api.js';

const router = Router();

/**
 * POST /api/detect
 * Trigger detection for an episode (mock PCXR model)
 */
router.post(
  '/detect',
  authenticateJWT,
  requirePermission('episodes:update'),
  async (req: Request, res: Response) => {
    try {
      const { episode_id } = req.body;

      if (!episode_id) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'episode_id is required',
          },
        });
      }

      logger.info('Triggering detection', {
        userId: req.userId,
        episodeId: episode_id,
      });

      // Check if episode exists
      const { data: episode, error: episodeError } = await supabase
        .from('episodes')
        .select('episode_id, status')
        .eq('episode_id', episode_id)
        .single();

      if (episodeError || !episode) {
        logger.warn('Episode not found', { episodeId: episode_id });
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Episode not found',
          },
        });
      }

      // Check if episode has images
      const { data: images, error: imagesError } = await supabase
        .from('images')
        .select('image_id')
        .eq('episode_id', episode_id);

      if (imagesError || !images || images.length === 0) {
        logger.warn('No images found for episode', { episodeId: episode_id });
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_IMAGES',
            message: 'Episode has no images to detect',
          },
        });
      }

      // Create detection job
      const { data: detectionJob, error: jobError } = await supabase
        .from('detection_results')
        .insert({
          episode_id: episode_id,
          status: 'processing',
          progress: 0,
          results: null,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (jobError || !detectionJob) {
        logger.error('Failed to create detection job', { error: jobError?.message });
        return res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to create detection job',
          },
        });
      }

      // Update episode status to pending_explain
      await supabase
        .from('episodes')
        .update({ status: 'pending_explain' })
        .eq('episode_id', episode_id);

      // Simulate detection processing (mock PCXR model)
      // In production, this would trigger actual ML model
      simulateDetection(detectionJob.result_id, episode_id);

      logger.info('Detection job created', {
        jobId: detectionJob.result_id,
        episodeId: episode_id,
      });

      const response: ApiResponse<{
        job_id: string;
        status: string;
        progress: number;
      }> = {
        success: true,
        job_id: detectionJob.result_id,
        status: 'processing',
        progress: 0,
      };

      res.json(response);
    } catch (error) {
      logger.error('Detection trigger error', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
      });
    }
  }
);

/**
 * GET /api/detect/:id
 * Poll detection status and results
 */
router.get(
  '/detect/:id',
  authenticateJWT,
  requirePermission('episodes:read'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      logger.info('Polling detection status', {
        userId: req.userId,
        jobId: id,
      });

      // Fetch detection job
      const { data: detection, error: detectionError } = await supabase
        .from('detection_results')
        .select('*')
        .eq('result_id', id)
        .single();

      if (detectionError || !detection) {
        logger.warn('Detection job not found', { jobId: id });
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Detection job not found',
          },
        });
      }

      // Build response
      const response: ApiResponse<DetectionStatusResponse> = {
        success: true,
        job_id: detection.result_id,
        status: detection.status,
        progress: detection.progress || 0,
        results: detection.results || undefined,
        error: detection.error_message || undefined,
        created_at: detection.created_at,
        completed_at: detection.completed_at || undefined,
      };

      logger.info('Detection status retrieved', {
        jobId: id,
        status: detection.status,
        progress: detection.progress,
      });

      res.json(response);
    } catch (error) {
      logger.error('Detection polling error', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
      });
    }
  }
);

/**
 * Simulate detection processing (mock PCXR model)
 * In production, this would call actual ML model API
 */
async function simulateDetection(jobId: string, episodeId: string): Promise<void> {
  // Simulate processing steps
  const steps = [
    { progress: 10, message: 'Loading images...', delay: 500 },
    { progress: 30, message: 'Preprocessing...', delay: 800 },
    { progress: 50, message: 'Running detection model...', delay: 1500 },
    { progress: 70, message: 'Post-processing results...', delay: 700 },
    { progress: 90, message: 'Finalizing...', delay: 500 },
  ];

  for (const step of steps) {
    await new Promise((resolve) => setTimeout(resolve, step.delay));

    await supabase
      .from('detection_results')
      .update({
        progress: step.progress,
      })
      .eq('result_id', jobId);

    logger.debug('Detection progress', {
      jobId,
      episodeId,
      progress: step.progress,
      message: step.message,
    });
  }

  // Generate mock detection results
  const mockResults = {
    model_version: 'PCXR-v1.0-mock',
    detections: [
      {
        label: 'Infiltrate',
        confidence: 0.87,
        bbox: [120, 80, 200, 160] as [number, number, number, number],
        location: 'Phổi phải, thùy dưới',
      },
      {
        label: 'Consolidation',
        confidence: 0.92,
        bbox: [150, 100, 220, 180] as [number, number, number, number],
        location: 'Phổi phải, thùy giữa',
      },
    ],
    findings: ['Infiltrate phổi phải', 'Consolidation thùy giữa'],
    severity: 'moderate',
    timestamp: new Date().toISOString(),
  };

  // Update detection results
  await supabase
    .from('detection_results')
    .update({
      status: 'completed',
      progress: 100,
      results: mockResults,
      completed_at: new Date().toISOString(),
    })
    .eq('result_id', jobId);

  // Update episode with findings and status
  await supabase
    .from('episodes')
    .update({
      findings: mockResults.findings,
      status: 'pending_explain',
    })
    .eq('episode_id', episodeId);

  logger.info('Detection completed', {
    jobId,
    episodeId,
    findings: mockResults.findings,
  });
}

export default router;
