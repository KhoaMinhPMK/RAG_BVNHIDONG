import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase/client.js';
import { authenticateJWT } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { logger } from '../utils/logger.js';
import type { ApiResponse } from '../types/api.js';

const router = Router();

/**
 * POST /api/episodes/:id/detect
 * Trigger detection for an episode (mock PCXR model)
 */
router.post(
  '/episodes/:id/detect',
  authenticateJWT,
  requirePermission('episodes:update'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      logger.info('Triggering detection', {
        userId: req.userId,
        episodeId: id,
      });

      // Check if episode exists
      const { data: episode, error: episodeError } = await supabase
        .from('episodes')
        .select('id, status')
        .eq('id', id)
        .single();

      if (episodeError || !episode) {
        logger.warn('Episode not found', { episodeId: id });
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
        .eq('episode_id', id);

      if (imagesError || !images || images.length === 0) {
        logger.warn('No images found for episode', { episodeId: id });
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
          episode_id: id,
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

      // Update episode status to pending_detection
      await supabase
        .from('episodes')
        .update({ status: 'pending_explain' })
        .eq('id', id);

      // Simulate detection processing (mock PCXR model)
      // In production, this would trigger actual ML model
      simulateDetection(detectionJob.id, id);

      logger.info('Detection job created', {
        jobId: detectionJob.id,
        episodeId: id,
      });

      const response: ApiResponse<{
        job_id: string;
        status: string;
        progress: number;
      }> = {
        success: true,
        job_id: detectionJob.id,
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
 * GET /api/episodes/:id/detection/status
 * Poll detection status and results
 */
router.get(
  '/episodes/:id/detection/status',
  authenticateJWT,
  requirePermission('episodes:read'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      logger.debug('Polling detection status', {
        userId: req.userId,
        episodeId: id,
      });

      // Get latest detection result
      const { data: detection, error: detectionError } = await supabase
        .from('detection_results')
        .select('*')
        .eq('episode_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (detectionError || !detection) {
        logger.warn('No detection found', { episodeId: id });
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'No detection job found for this episode',
          },
        });
      }

      const response: ApiResponse<{
        job_id: string;
        status: 'pending' | 'processing' | 'completed' | 'failed';
        progress: number;
        results?: any;
        error?: string;
        created_at: string;
        completed_at?: string;
      }> = {
        success: true,
        job_id: detection.id,
        status: detection.status,
        progress: detection.progress || 0,
        results: detection.results,
        error: detection.error,
        created_at: detection.created_at,
        completed_at: detection.completed_at,
      };

      res.json(response);
    } catch (error) {
      logger.error('Detection status error', { error: (error as Error).message });
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
 * In production, this would call actual ML model on A100
 */
async function simulateDetection(jobId: string, episodeId: string) {
  const steps = [
    { progress: 20, delay: 2000, message: 'Loading model...' },
    { progress: 40, delay: 2000, message: 'Preprocessing images...' },
    { progress: 60, delay: 2000, message: 'Running inference...' },
    { progress: 80, delay: 2000, message: 'Post-processing results...' },
    { progress: 100, delay: 2000, message: 'Complete' },
  ];

  for (const step of steps) {
    await new Promise(resolve => setTimeout(resolve, step.delay));

    await supabase
      .from('detection_results')
      .update({
        progress: step.progress,
        status: step.progress === 100 ? 'completed' : 'processing',
      })
      .eq('id', jobId);

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
        bbox: [120, 80, 200, 160],
        location: 'Phổi phải, thùy dưới',
      },
      {
        label: 'Consolidation',
        confidence: 0.92,
        bbox: [150, 100, 220, 180],
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
    .eq('id', jobId);

  // Update episode with findings and status
  await supabase
    .from('episodes')
    .update({
      findings: mockResults.findings,
      status: 'pending_explain',
    })
    .eq('id', episodeId);

  logger.info('Detection completed', {
    jobId,
    episodeId,
    findings: mockResults.findings,
  });
}

export default router;
