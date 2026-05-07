/**
 * Document Management Routes
 * Admin API for managing knowledge base documents
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { supabase } from '../lib/supabase/client.js';
import { authenticateJWT } from '../middleware/auth.js';
import { logger } from '../lib/utils/logger.js';
import { ingestionService } from '../lib/ingestion/service.js';
import { ingestionJobStore } from '../lib/ingestion/job-store.js';
import type { IngestionProgressUpdate } from '../lib/ingestion/types.js';

const router = Router();
const KNOWLEDGE_ARTIFACT_DIR = path.resolve('knowledge_base', 'uploads');

// Multer: save uploaded PDFs to a temp dir
const UPLOAD_DIR = path.resolve('uploads', 'documents');
const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safe}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  },
});

function getAuthenticatedRole(req: Request): string {
  return req.userRole || req.user?.role || '';
}

function getAuthenticatedUserId(req: Request): string {
  return req.userId || req.user?.id || req.user?.sub || 'unknown';
}

function requireDocumentId(req: Request, res: Response): string | null {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  if (!id) {
    res.status(400).json({
      error: 'Invalid input',
      message: 'Document id is required',
    });
    return null;
  }

  return id;
}

function sanitizeArtifactName(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function persistUploadedArtifact(tempPath: string, originalName: string): Promise<string> {
  await fs.mkdir(KNOWLEDGE_ARTIFACT_DIR, { recursive: true });
  const artifactPath = path.join(
    KNOWLEDGE_ARTIFACT_DIR,
    `${Date.now()}_${sanitizeArtifactName(originalName)}`
  );

  await fs.rename(tempPath, artifactPath);
  return artifactPath;
}

function getDocumentSourceArtifact(document: {
  metadata?: Record<string, unknown> | null;
  source?: string | null;
}): { path: string; managed: boolean; originalName?: string } | null {
  const metadata = (document.metadata as Record<string, unknown> | null | undefined) ?? {};
  const artifactPath = metadata.source_artifact_path;

  if (typeof artifactPath === 'string' && artifactPath.trim().length > 0) {
    return {
      path: artifactPath,
      managed: Boolean(metadata.source_artifact_managed),
      originalName:
        typeof metadata.source_artifact_original_name === 'string'
          ? metadata.source_artifact_original_name
          : undefined,
    };
  }

  if (
    typeof document.source === 'string' &&
    /[\\/]/.test(document.source) &&
    document.source.toLowerCase().endsWith('.pdf')
  ) {
    return {
      path: document.source,
      managed: false,
    };
  }

  return null;
}

async function removeManagedArtifact(document: {
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  const metadata = (document.metadata as Record<string, unknown> | null | undefined) ?? {};
  const artifactPath = metadata.source_artifact_path;
  const managed = Boolean(metadata.source_artifact_managed);

  if (!managed || typeof artifactPath !== 'string' || artifactPath.trim().length === 0) {
    return;
  }

  try {
    await fs.unlink(artifactPath);
  } catch (error) {
    logger.warn('Failed to remove managed source artifact', {
      artifactPath,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET /api/documents/jobs/:jobId
 * Read ingestion or reingest progress for document jobs
 */
router.get('/jobs/:jobId', authenticateJWT, async (req, res) => {
  const role = getAuthenticatedRole(req);
  const allowedRoles = ['admin', 'clinician', 'radiologist', 'researcher'];

  if (!allowedRoles.includes(role)) {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Insufficient permissions to read ingestion jobs' },
    });
  }

  const rawJobId = req.params.jobId;
  const jobId = Array.isArray(rawJobId) ? rawJobId[0] : rawJobId;

  if (!jobId) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_JOB_ID', message: 'Job id is required' },
    });
  }

  const job = ingestionJobStore.getJob(jobId);

  if (!job) {
    return res.status(404).json({
      success: false,
      error: { code: 'JOB_NOT_FOUND', message: 'Ingestion job not found' },
    });
  }

  return res.json({
    success: true,
    job,
  });
});

/**
 * GET /api/documents
 * List all documents with stats
 */
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const role = getAuthenticatedRole(req);

    // Clinicians and admins can list documents
    const allowedRoles = ['admin', 'clinician', 'radiologist', 'researcher'];
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions to access document management',
      });
    }

    // Get documents with chunk counts
    const { data: documents, error } = await supabase
      .from('documents')
      .select(`
        id,
        title,
        version,
        source,
        effective_date,
        owner,
        age_group,
        status,
        language,
        access_level,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch documents', { error: error.message });
      return res.status(500).json({
        error: 'Database error',
        message: error.message,
      });
    }

    // Get chunk counts in a single aggregated query (avoids N+1 round-trips)
    const docIds = (documents || []).map((d) => d.id);
    const chunkCountMap: Record<string, number> = {};
    if (docIds.length > 0) {
      const { data: chunkRows } = await supabase
        .from('chunks')
        .select('document_id')
        .in('document_id', docIds);
      (chunkRows || []).forEach((row) => {
        chunkCountMap[row.document_id] = (chunkCountMap[row.document_id] || 0) + 1;
      });
    }

    const documentsWithStats = (documents || []).map((doc) => ({
      ...doc,
      chunk_count: chunkCountMap[doc.id] || 0,
    }));

    logger.info('Documents listed', {
      count: documentsWithStats.length,
      user: getAuthenticatedUserId(req),
    });

    res.json({
      success: true,
      documents: documentsWithStats,
      total: documentsWithStats.length,
    });
  } catch (err) {
    logger.error('Document list error', { error: err });
    res.status(500).json({
      error: 'Internal server error',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/documents/:id
 * Get document detail with chunks
 */
router.get('/:id', authenticateJWT, async (req, res) => {
  try {
    const role = getAuthenticatedRole(req);
    const id = requireDocumentId(req, res);

    if (!id) {
      return;
    }

    // Only admin can access
    if (role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only admin can access document management',
      });
    }

    // Get document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (docError || !document) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Document not found',
      });
    }

    // Get chunks
    const { data: chunks, error: chunksError } = await supabase
      .from('chunks')
      .select('id, chunk_index, content, created_at')
      .eq('document_id', id)
      .order('chunk_index', { ascending: true });

    if (chunksError) {
      logger.error('Failed to fetch chunks', { error: chunksError.message });
      return res.status(500).json({
        error: 'Database error',
        message: chunksError.message,
      });
    }

    logger.info('Document detail fetched', {
      documentId: id,
      chunkCount: chunks?.length || 0,
      user: getAuthenticatedUserId(req),
    });

    res.json({
      document,
      chunks: chunks || [],
      chunk_count: chunks?.length || 0,
    });
  } catch (err) {
    logger.error('Document detail error', { error: err });
    res.status(500).json({
      error: 'Internal server error',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/documents/:id
 * Delete document and all its chunks
 */
router.delete('/:id', authenticateJWT, async (req, res) => {
  try {
    const role = getAuthenticatedRole(req);
    const id = requireDocumentId(req, res);

    if (!id) {
      return;
    }

    // Only admin can delete
    if (role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only admin can delete documents',
      });
    }

    // Check document exists
    const { data: document, error: checkError } = await supabase
      .from('documents')
      .select('id, title, metadata')
      .eq('id', id)
      .single();

    if (checkError || !document) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Document not found',
      });
    }

    // Delete chunks first (cascade should handle this, but explicit is safer)
    const { error: chunksError } = await supabase
      .from('chunks')
      .delete()
      .eq('document_id', id);

    if (chunksError) {
      logger.error('Failed to delete chunks', { error: chunksError.message });
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to delete document chunks',
      });
    }

    // Delete document
    const { error: docError } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (docError) {
      logger.error('Failed to delete document', { error: docError.message });
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to delete document',
      });
    }

    logger.info('Document deleted', {
      documentId: id,
      title: document.title,
      user: getAuthenticatedUserId(req),
    });

    await removeManagedArtifact(document);

    res.json({
      success: true,
      message: 'Document deleted successfully',
      document_id: id,
    });
  } catch (err) {
    logger.error('Document delete error', { error: err });
    res.status(500).json({
      error: 'Internal server error',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/documents/:id/reingest
 * Re-ingest document (regenerate chunks and embeddings)
 */
router.post('/:id/reingest', authenticateJWT, async (req, res) => {
  try {
    const role = getAuthenticatedRole(req);
    const id = requireDocumentId(req, res);

    if (!id) {
      return;
    }

    // Only admin can reingest
    if (role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only admin can reingest documents',
      });
    }

    // Get document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, title, source, metadata')
      .eq('id', id)
      .single();

    if (docError || !document) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Document not found',
      });
    }

    const sourceArtifact = getDocumentSourceArtifact(document);

    if (!sourceArtifact?.path) {
      return res.status(400).json({
        error: 'Source artifact unavailable',
        message: 'Document does not have a reusable source artifact for reingest',
      });
    }

    // Check if source file exists
    try {
      await fs.access(sourceArtifact.path);
    } catch {
      return res.status(409).json({
        error: 'Source artifact missing',
        message: `Cannot reingest: source artifact ${sourceArtifact.path} does not exist`,
      });
    }

    logger.info('Starting document reingest', {
      documentId: id,
      title: document.title,
      source: sourceArtifact.path,
      user: getAuthenticatedUserId(req),
    });

    const job = ingestionJobStore.createJob(sourceArtifact.path);

    ingestionService
      .ingestDocument(sourceArtifact.path, {
        chunking: {
          max_tokens: 512,
          overlap_tokens: 50,
        },
        skip_existing: false,
        existingDocumentId: id,
        sourceArtifact,
        progressCallback: (update: IngestionProgressUpdate) => {
          ingestionJobStore.applyProgress(job.id, update);
        },
      })
      .then((result) => {
        ingestionJobStore.completeJob(job.id, result);
        logger.info('Document reingest completed', {
          documentId: result.document_id,
          jobId: job.id,
          chunks: result.chunks_created,
          tokens: result.total_tokens,
        });
      })
      .catch((error) => {
        ingestionJobStore.failJob(job.id, error instanceof Error ? error.message : 'Document reingest failed');
        logger.error('Document reingest failed', {
          documentId: id,
          jobId: job.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });

    res.status(202).json({
      success: true,
      message: 'Document reingest started',
      document_id: id,
      job_id: job.id,
      status: 'processing',
    });
  } catch (err) {
    logger.error('Document reingest error', { error: err });
    res.status(500).json({
      error: 'Internal server error',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/documents/upload
 * Upload a PDF and run the full embedding pipeline (parse → chunk → embed → store)
 * Accepts multipart/form-data: file (PDF), title, source, effective_date (optional)
 */
router.post(
  '/upload',
  authenticateJWT,
  upload.single('file'),
  async (req: Request, res: Response) => {
    let uploadedPath = (req as any).file?.path as string | undefined;

    try {
      const role = getAuthenticatedRole(req);

      // Clinicians, radiologists, researchers and admins can upload
      const allowedRoles = ['admin', 'clinician', 'radiologist', 'researcher'];
      if (!allowedRoles.includes(role)) {
        if (uploadedPath) await fs.unlink(uploadedPath).catch(() => {});
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Insufficient permissions to upload documents' },
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_FILE', message: 'No PDF file uploaded' },
        });
      }

      uploadedPath = req.file.path;
      uploadedPath = await persistUploadedArtifact(uploadedPath, req.file.originalname);

      const { title, source, effective_date, trust_level } = req.body as {
        title?: string;
        source?: string;
        effective_date?: string;
        trust_level?: 'internal' | 'reference';
      };

      // Enforce: internal docs require admin role
      if (trust_level === 'internal' && role !== 'admin') {
        if (uploadedPath) await fs.unlink(uploadedPath).catch(() => {});
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Chỉ admin mới có thể đăng tải tài liệu nội bộ' },
        });
      }

      logger.info('Document upload started', {
        originalName: req.file.originalname,
        size: req.file.size,
        filePath: uploadedPath,
        user: getAuthenticatedUserId(req),
        trust_level: trust_level || 'reference',
      });

      // Map trust_level → source
      const resolvedSource = trust_level === 'internal' ? 'Internal' : (source || 'Other');

      const job = ingestionJobStore.createJob(uploadedPath);
      const metadataOverride = (title || resolvedSource || effective_date)
        ? {
            ...(title && { title }),
            source: resolvedSource,
            ...(effective_date && { effective_date }),
          }
        : undefined;

      ingestionService
        .ingestDocument(uploadedPath, {
          metadataOverride,
          metadataPatch: {
            trust_level: trust_level || 'reference',
            ingest_transport: 'upload',
          },
          sourceArtifact: {
            path: uploadedPath,
            original_name: req.file.originalname,
            managed: true,
          },
          skip_existing: false,
          progressCallback: (update: IngestionProgressUpdate) => {
            ingestionJobStore.applyProgress(job.id, update);
          },
        } as any)
        .then((result) => {
          ingestionJobStore.completeJob(job.id, result);
          logger.info('Document upload complete', {
            documentId: result.document_id,
            jobId: job.id,
            chunks: result.chunks_created,
            tokens: result.total_tokens,
          });
        })
        .catch((error) => {
          ingestionJobStore.failJob(job.id, error instanceof Error ? error.message : 'Ingestion pipeline failed');
          logger.error('Document upload failed', {
            jobId: job.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        });

      return res.status(202).json({
        success: true,
        job_id: job.id,
        status: 'processing',
        message: 'Upload accepted and ingestion started',
        artifact_path: uploadedPath,
      });
    } catch (err) {
      if (uploadedPath) await fs.unlink(uploadedPath).catch(() => {});
      logger.error('Document upload error', { error: err });
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error',
        },
      });
    }
  }
);

export default router;
