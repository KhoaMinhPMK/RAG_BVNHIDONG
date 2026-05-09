import { Router, Request, Response } from 'express';
import multer from 'multer';
import FormData from 'form-data';
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
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function getCxrUrl(): string {
  return process.env.CXR_SERVICE_URL ?? '';
}

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
 * Create new episode (multipart/form-data with optional image field)
 */
router.post(
  '/episodes',
  authenticateJWT,
  requirePermission('episodes:create'),
  upload.single('image'),
  async (req: Request, res: Response) => {
    try {
      // Support both multipart form fields and JSON body
      const body = req.body as Record<string, string>;

      const patient_ref = body.patient_ref;
      const admission_date = body.date || body.admission_date;

      if (!patient_ref || !admission_date) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Missing required fields: patient_ref, date',
          },
        });
      }

      logger.info('Creating new episode', {
        userId: req.userId,
        patientRef: patient_ref,
        hasImage: !!req.file,
      });

      const { data: episodeRow, error: episodeErr } = await supabase
        .from('episodes')
        .insert({
          patient_id: patient_ref,
          patient_ref,
          age: body.age || null,
          gender: body.gender || null,
          admission_date,
          chief_complaint: body.symptoms || null,
          vital_signs: body.spo2 ? { spo2: body.spo2 } : null,
          lab_results: body.crp ? { crp: body.crp } : null,
          status: 'pending_detection',
          findings: [],
          created_by: req.userId,
        })
        .select()
        .single();

      if (episodeErr || !episodeRow) {
        logger.error('Failed to create episode', { error: episodeErr?.message });
        return res.status(500).json({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to create episode', details: episodeErr?.message },
        });
      }

      const episodeId: string = episodeRow.id;

      // ─── Upload X-ray image to Storage if provided ─────────────────────────
      let imagePath: string | null = null;
      if (req.file) {
        const ext = req.file.originalname.split('.').pop() ?? 'png';
        const storagePath = `episodes/${episodeId}/${Date.now()}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from('xray-images')
          .upload(storagePath, req.file.buffer, {
            contentType: req.file.mimetype,
            upsert: false,
          });

        if (uploadErr) {
          logger.error('[Episodes] Image upload failed', { error: uploadErr.message, episodeId });
        } else {
          imagePath = storagePath;
          await supabase.from('images').insert({
            episode_id: episodeId,
            storage_path: storagePath,
            file_name: req.file.originalname,
            file_size: req.file.size,
            mime_type: req.file.mimetype,
          });
          logger.info('[Episodes] Image uploaded', { episodeId, storagePath });
        }
      }

      // ─── Trigger CXR analysis asynchronously ───────────────────────────────
      if (req.file && imagePath && getCxrUrl()) {
        setImmediate(async () => {
          let resultId: string | null = null;
          try {
            const { data: inserted } = await supabase
              .from('detection_results')
              .upsert({ episode_id: episodeId, status: 'processing', progress: 0 }, { onConflict: 'episode_id' })
              .select('result_id')
              .single();
            resultId = inserted?.result_id ?? null;

            const form = new FormData();
            form.append('file', req.file!.buffer, {
              filename: req.file!.originalname,
              contentType: req.file!.mimetype,
            });
            const formBuffer = form.getBuffer();

            const cxrRes = await fetch(`${getCxrUrl()}/analyze`, {
              method: 'POST',
              body: formBuffer,
              headers: {
                'Content-Type': `multipart/form-data; boundary=${form.getBoundary()}`,
                'Content-Length': String(formBuffer.length),
              },
              signal: AbortSignal.timeout(90_000),
            });

            if (!cxrRes.ok) throw new Error(`CXR HTTP ${cxrRes.status}`);

            const cxrData = await cxrRes.json() as { top_finding: string; predictions: unknown[] };
            await supabase.from('detection_results')
              .upsert({
                episode_id: episodeId,
                status: 'completed',
                progress: 100,
                results: { top_finding: cxrData.top_finding, predictions: cxrData.predictions },
              }, { onConflict: 'episode_id' });

            logger.info('[Episodes] CXR auto-analysis complete', { episodeId, top: cxrData.top_finding });
          } catch (err) {
            logger.error('[Episodes] CXR auto-analysis failed', { episodeId, error: (err as Error).message });
            await supabase.from('detection_results')
              .upsert({
                episode_id: episodeId,
                status: 'failed',
                progress: 0,
                error_message: (err as Error).message,
              }, { onConflict: 'episode_id' });
          }
        });
      }

      const episode: Episode = {
        episode_id: episodeId,
        patient_ref: episodeRow.patient_ref,
        age: episodeRow.age,
        gender: episodeRow.gender,
        admission_date: episodeRow.admission_date,
        status: episodeRow.status,
        findings: episodeRow.findings || [],
        chief_complaint: episodeRow.chief_complaint,
        vital_signs: episodeRow.vital_signs,
        lab_results: episodeRow.lab_results,
        created_by: episodeRow.created_by,
        created_at: episodeRow.created_at,
        updated_at: episodeRow.updated_at,
      };

      logger.info('Episode created successfully', { episodeId, hasImage: !!imagePath });

      return res.status(201).json({ success: true, episode, has_image: !!imagePath });
    } catch (error) {
      logger.error('Create episode error', { error: (error as Error).message });
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      });
    }
  }
);

/**
 * GET /api/episodes/:id/image-url
 * Get signed URL for the episode's X-ray image
 */
router.get(
  '/episodes/:id/image-url',
  authenticateJWT,
  requirePermission('episodes:read'),
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const { data: imgRow } = await supabase
      .from('images')
      .select('image_id, storage_path, file_name, mime_type, uploaded_at')
      .eq('episode_id', id)
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!imgRow) {
      return res.json({ success: true, url: null, image: null });
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from('xray-images')
      .createSignedUrl(imgRow.storage_path, 3600);

    if (signErr || !signed) {
      return res.status(500).json({ success: false, error: { message: signErr?.message || 'Failed to sign URL' } });
    }

    return res.json({ success: true, url: signed.signedUrl, image: imgRow });
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
