import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase/client.js';
import { authenticateJWT } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { logger } from '../utils/logger.js';
import type { ApiResponse } from '../types/api.js';

const router = Router();

interface UploadRequest {
  patient_info: {
    patient_ref: string;
    age: string;
    gender: string;
    admission_date: string;
    chief_complaint?: string;
    vital_signs?: {
      temp?: number;
      spo2?: number;
      [key: string]: any;
    };
    lab_results?: {
      wbc?: number;
      crp?: number;
      [key: string]: any;
    };
  };
  files: Array<{
    file_name: string;
    file_size: number;
    mime_type: string;
  }>;
}

interface UploadResponse {
  episode_id: string;
  status: string;
  upload_urls: Array<{
    image_id: string;
    file_name: string;
    upload_url: string;
    storage_path: string;
  }>;
}

/**
 * POST /api/episodes/upload
 * Create episode and generate presigned URLs for image upload
 */
router.post(
  '/episodes/upload',
  authenticateJWT,
  requirePermission('episodes:create'),
  async (req: Request, res: Response) => {
    try {
      const body = req.body as UploadRequest;

      // Validate required fields
      if (!body.patient_info || !body.files || body.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Missing required fields: patient_info and files',
          },
        });
      }

      const { patient_info, files } = body;

      // Validate patient info
      if (!patient_info.patient_ref || !patient_info.age || !patient_info.gender || !patient_info.admission_date) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Missing required patient info: patient_ref, age, gender, admission_date',
          },
        });
      }

      // Validate file count (max 10 images per episode)
      if (files.length > 10) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Maximum 10 images per episode',
          },
        });
      }

      // Validate file sizes (max 10MB each)
      const invalidFiles = files.filter(f => f.file_size > 10 * 1024 * 1024);
      if (invalidFiles.length > 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'File size exceeds 10MB limit',
            details: invalidFiles.map(f => f.file_name),
          },
        });
      }

      logger.info('Creating episode for upload', {
        userId: req.userId,
        patientRef: patient_info.patient_ref,
        fileCount: files.length,
      });

      // Step 1: Create episode record
      const { data: episodeData, error: episodeError } = await supabase
        .from('episodes')
        .insert({
          patient_ref: patient_info.patient_ref,
          age: patient_info.age,
          gender: patient_info.gender,
          admission_date: patient_info.admission_date,
          chief_complaint: patient_info.chief_complaint,
          vital_signs: patient_info.vital_signs,
          lab_results: patient_info.lab_results,
          status: 'pending_detection',
          findings: [],
          created_by: req.userId,
        })
        .select()
        .single();

      if (episodeError || !episodeData) {
        logger.error('Failed to create episode', { error: episodeError?.message });
        return res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to create episode',
            details: episodeError?.message,
          },
        });
      }

      const episodeId = episodeData.id;

      logger.info('Episode created', { episodeId });

      // Step 2: Generate presigned URLs for each file
      const uploadUrls: UploadResponse['upload_urls'] = [];

      for (const file of files) {
        // Generate unique image ID
        const { data: imageData, error: imageError } = await supabase
          .from('images')
          .insert({
            episode_id: episodeId,
            file_name: file.file_name,
            file_size: file.file_size,
            mime_type: file.mime_type,
            storage_path: '', // Will be updated after upload
          })
          .select()
          .single();

        if (imageError || !imageData) {
          logger.error('Failed to create image record', { error: imageError?.message });
          continue;
        }

        const imageId = imageData.image_id;
        const fileExt = file.file_name.split('.').pop() || 'png';
        const storagePath = `${episodeId}/${imageId}.${fileExt}`;

        // Generate presigned URL for upload (valid for 1 hour)
        const { data: urlData, error: urlError } = await supabase.storage
          .from('xray-images')
          .createSignedUploadUrl(storagePath);

        if (urlError || !urlData) {
          logger.error('Failed to generate presigned URL', {
            error: urlError?.message,
            storagePath,
          });
          continue;
        }

        // Update image record with storage path
        await supabase
          .from('images')
          .update({ storage_path: storagePath })
          .eq('image_id', imageId);

        uploadUrls.push({
          image_id: imageId,
          file_name: file.file_name,
          upload_url: urlData.signedUrl,
          storage_path: storagePath,
        });

        logger.info('Generated upload URL', { imageId, storagePath });
      }

      // Step 3: Create detection job record (queued)
      const { error: detectionError } = await supabase
        .from('detection_results')
        .insert({
          episode_id: episodeId,
          status: 'queued',
          progress: 0,
        });

      if (detectionError) {
        logger.warn('Failed to create detection job', { error: detectionError.message });
      }

      const response: ApiResponse<UploadResponse> = {
        success: true,
        episode_id: episodeId,
        status: 'pending_detection',
        upload_urls: uploadUrls,
      };

      logger.info('Upload URLs generated successfully', {
        episodeId,
        urlCount: uploadUrls.length,
      });

      res.status(201).json(response);
    } catch (error) {
      logger.error('Upload endpoint error', { error: (error as Error).message });
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
