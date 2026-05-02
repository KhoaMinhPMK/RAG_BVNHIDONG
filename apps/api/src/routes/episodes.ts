import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase/client.js';
import { authenticateJWT } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { logger } from '../utils/logger.js';
import type {
  Episode,
  EpisodeListRequest,
  EpisodeListResponse,
  EpisodeDetailResponse,
  CreateEpisodeRequest,
  UpdateEpisodeRequest,
  ApiResponse,
} from '../types/api.js';

const router = Router();

/**
 * GET /api/episodes
 * List episodes with pagination and filtering
 */
router.get(
  '/episodes',
  authenticateJWT,
  requirePermission('episodes:read'),
  async (req: Request, res: Response) => {
    try {
      const { status, limit = 50, offset = 0 } = req.query as unknown as EpisodeListRequest;

      logger.info('Fetching episodes list', {
        userId: req.userId,
        status,
        limit,
        offset,
      });

      // Build query
      let query = supabase
        .from('episodes')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      // Filter by status if provided
      if (status) {
        query = query.eq('status', status);
      }

      const { data, error, count } = await query;

      if (error) {
        logger.error('Failed to fetch episodes', { error: error.message });
        return res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to fetch episodes',
            details: error.message,
          },
        });
      }

      const episodes: Episode[] = (data || []).map((row: any) => ({
        episode_id: row.id, // Database uses 'id' column
        patient_ref: row.patient_ref,
        age: row.age,
        gender: row.gender,
        admission_date: row.admission_date,
        status: row.status || 'pending_detection',
        findings: row.findings || [],
        chief_complaint: row.chief_complaint,
        vital_signs: row.vital_signs,
        lab_results: row.lab_results,
        created_by: row.created_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));

      const total = count || 0;
      const hasMore = Number(offset) + Number(limit) < total;

      const response: ApiResponse<EpisodeListResponse> = {
        success: true,
        episodes,
        total,
        hasMore,
      };

      logger.info('Episodes fetched successfully', {
        count: episodes.length,
        total,
        hasMore,
      });

      res.json(response);
    } catch (error) {
      logger.error('Episodes list error', { error: (error as Error).message });
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
 * GET /api/episodes/:id
 * Get single episode with images and detection results
 */
router.get(
  '/episodes/:id',
  authenticateJWT,
  requirePermission('episodes:read'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      logger.info('Fetching episode detail', {
        userId: req.userId,
        episodeId: id,
      });

      // Fetch episode
      const { data: episodeData, error: episodeError } = await supabase
        .from('episodes')
        .select('*')
        .eq('id', id)
        .single();

      if (episodeError || !episodeData) {
        logger.warn('Episode not found', { episodeId: id });
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Episode not found',
          },
        });
      }

      // Fetch images
      const { data: imagesData } = await supabase
        .from('images')
        .select('image_id, file_name, storage_path, uploaded_at')
        .eq('episode_id', id);

      // Fetch detection results
      const { data: detectionData } = await supabase
        .from('detection_results')
        .select('status, progress, results')
        .eq('episode_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const episode: Episode = {
        episode_id: episodeData.id, // Database uses 'id' column
        patient_ref: episodeData.patient_ref,
        age: episodeData.age,
        gender: episodeData.gender,
        admission_date: episodeData.admission_date,
        status: episodeData.status || 'pending_detection',
        findings: episodeData.findings || [],
        chief_complaint: episodeData.chief_complaint,
        vital_signs: episodeData.vital_signs,
        lab_results: episodeData.lab_results,
        created_by: episodeData.created_by,
        created_at: episodeData.created_at,
        updated_at: episodeData.updated_at,
      };

      const response: ApiResponse<EpisodeDetailResponse> = {
        success: true,
        episode,
        images: imagesData || [],
        detection_results: detectionData
          ? {
              status: detectionData.status,
              progress: detectionData.progress,
              results: detectionData.results,
            }
          : undefined,
      };

      logger.info('Episode detail fetched successfully', { episodeId: id });

      res.json(response);
    } catch (error) {
      logger.error('Episode detail error', { error: (error as Error).message });
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
 * POST /api/episodes
 * Create new episode
 */
router.post(
  '/episodes',
  authenticateJWT,
  requirePermission('episodes:create'),
  async (req: Request, res: Response) => {
    try {
      const body = req.body as CreateEpisodeRequest;

      // Validate required fields
      if (!body.patient_ref || !body.age || !body.gender || !body.admission_date) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Missing required fields: patient_ref, age, gender, admission_date',
          },
        });
      }

      logger.info('Creating new episode', {
        userId: req.userId,
        patientRef: body.patient_ref,
      });

      const { data, error } = await supabase
        .from('episodes')
        .insert({
          patient_id: body.patient_ref, // Use patient_ref as patient_id
          patient_ref: body.patient_ref,
          age: body.age,
          gender: body.gender,
          admission_date: body.admission_date,
          chief_complaint: body.chief_complaint,
          vital_signs: body.vital_signs,
          lab_results: body.lab_results,
          status: 'pending_detection',
          findings: [],
          created_by: req.userId,
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to create episode', { error: error.message });
        return res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to create episode',
            details: error.message,
          },
        });
      }

      const episode: Episode = {
        episode_id: data.id, // Database uses 'id' column
        patient_ref: data.patient_ref,
        age: data.age,
        gender: data.gender,
        admission_date: data.admission_date,
        status: data.status,
        findings: data.findings || [],
        chief_complaint: data.chief_complaint,
        vital_signs: data.vital_signs,
        lab_results: data.lab_results,
        created_by: data.created_by,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      logger.info('Episode created successfully', { episodeId: episode.episode_id });

      res.status(201).json({
        success: true,
        episode,
      });
    } catch (error) {
      logger.error('Create episode error', { error: (error as Error).message });
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
 * PATCH /api/episodes/:id
 * Update episode status and data
 */
router.patch(
  '/episodes/:id',
  authenticateJWT,
  requirePermission('episodes:update'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const body = req.body as UpdateEpisodeRequest;

      logger.info('Updating episode', {
        userId: req.userId,
        episodeId: id,
        updates: Object.keys(body),
      });

      // Build update object
      const updates: any = {};
      if (body.status) updates.status = body.status;
      if (body.findings) updates.findings = body.findings;
      if (body.chief_complaint !== undefined) updates.chief_complaint = body.chief_complaint;
      if (body.vital_signs !== undefined) updates.vital_signs = body.vital_signs;
      if (body.lab_results !== undefined) updates.lab_results = body.lab_results;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'No valid fields to update',
          },
        });
      }

      const { data, error } = await supabase
        .from('episodes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update episode', { error: error.message });
        return res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to update episode',
            details: error.message,
          },
        });
      }

      if (!data) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Episode not found',
          },
        });
      }

      const episode: Episode = {
        episode_id: data.episode_id,
        patient_ref: data.patient_ref,
        age: data.age,
        gender: data.gender,
        admission_date: data.admission_date,
        status: data.status,
        findings: data.findings || [],
        chief_complaint: data.chief_complaint,
        vital_signs: data.vital_signs,
        lab_results: data.lab_results,
        created_by: data.created_by,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      logger.info('Episode updated successfully', { episodeId: id });

      res.json({
        success: true,
        episode,
      });
    } catch (error) {
      logger.error('Update episode error', { error: (error as Error).message });
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

export default router;
