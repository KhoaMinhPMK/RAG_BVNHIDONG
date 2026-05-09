/**
 * Document Management Routes
 * Admin API for managing knowledge base documents
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import { supabase } from '../lib/supabase/client.js';
import { authenticateJWT } from '../middleware/auth.js';
import { logger } from '../lib/utils/logger.js';
import { ingestionService } from '../lib/ingestion/service.js';
import { ingestionJobStore } from '../lib/ingestion/job-store.js';
import type { IngestionProgressUpdate } from '../lib/ingestion/types.js';
import {
  getStoragePdfLocationFromMetadata,
  removeKnowledgeSourcePdfFromStorage,
} from '../lib/supabase/knowledge-pdf-storage.js';

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

/** Roots on disk where served PDFs may live (path traversal guard). */
const SOURCE_PDF_ROOTS = [
  path.resolve(KNOWLEDGE_ARTIFACT_DIR),
  path.resolve(UPLOAD_DIR),
  path.resolve('knowledge_base'),
  /** `apps/knowledge_base` when cwd is `apps/api` */
  path.resolve('..', 'knowledge_base'),
  /** Repo root `…/RAG_…/knowledge_base` when cwd is `apps/api` */
  path.resolve('..', '..', 'knowledge_base'),
];

const KB_MARKER = 'knowledge_base/';

/**
 * DB may store absolute paths from another machine (e.g. …\\knowledge_base\\downloads\\x.pdf).
 * Return candidate absolute paths under each local `knowledge_base/` root (api cwd and repo root).
 */
function remapLegacyKnowledgeBaseCandidates(rawPath: string): string[] {
  const trimmed = rawPath.trim();
  if (!trimmed) return [];
  const unified = trimmed.replace(/\\/g, '/');
  const lower = unified.toLowerCase();
  const idx = lower.lastIndexOf(KB_MARKER);
  if (idx === -1) {
    return [];
  }
  const rel = unified.slice(idx + KB_MARKER.length).replace(/^\/+/, '');
  if (!rel.toLowerCase().endsWith('.pdf')) {
    return [];
  }
  const cwd = process.cwd();
  const bases = [
    path.join(cwd, 'knowledge_base'),
    path.join(cwd, '..', 'knowledge_base'),
    path.join(cwd, '..', '..', 'knowledge_base'),
  ];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const base of bases) {
    const abs = path.resolve(base, rel);
    if (!seen.has(abs)) {
      seen.add(abs);
      out.push(abs);
    }
  }
  return out;
}

function uniqueResolvedPaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of paths) {
    const n = path.resolve(p);
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

/**
 * Resolve an on-disk PDF path for streaming only if it lies under an allowed root.
 */
function resolveAllowedSourcePdf(
  artifactPath: string,
  originalName?: string
): { abs: string; downloadName: string } | null {
  const abs = path.resolve(artifactPath);
  if (!abs.toLowerCase().endsWith('.pdf')) {
    return null;
  }
  const allowed = SOURCE_PDF_ROOTS.some((root) => {
    const r = path.resolve(root);
    return abs === r || abs.startsWith(`${r}${path.sep}`);
  });
  if (!allowed) {
    return null;
  }
  const hint = originalName?.trim() ? sanitizeArtifactName(originalName.trim()) : '';
  const downloadName = (hint || path.basename(abs)).replace(/[^\w.\- ()\[\]]+/g, '_').slice(0, 200) || 'document.pdf';
  return { abs, downloadName };
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
 * GET /api/documents/:id/source
 * Stream the original PDF for preview (same RBAC as listing documents).
 */
router.get('/:id/source', authenticateJWT, async (req, res) => {
  try {
    const role = getAuthenticatedRole(req);
    const allowedRoles = ['admin', 'clinician', 'radiologist', 'researcher'];
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions to view documents' },
      });
    }

    const id = requireDocumentId(req, res);
    if (!id) return;

    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, title, source, metadata')
      .eq('id', id)
      .single();

    if (docError || !document) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' },
      });
    }

    const storageLoc = getStoragePdfLocationFromMetadata(
      document.metadata as Record<string, unknown> | null | undefined
    );
    if (storageLoc) {
      const { data: blob, error: dlError } = await supabase.storage
        .from(storageLoc.bucket)
        .download(storageLoc.objectPath);

      if (dlError || !blob) {
        logger.warn('Document PDF missing in storage', {
          documentId: id,
          bucket: storageLoc.bucket,
          objectPath: storageLoc.objectPath,
          error: dlError?.message,
        });
        return res.status(404).json({
          success: false,
          error: {
            code: 'SOURCE_MISSING',
            message:
              'Không tải được file PDF từ kho lưu trữ. Kiểm tra bucket Supabase Storage và quyền service role.',
          },
        });
      }

      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const hint = storageLoc.originalName?.trim()
        ? sanitizeArtifactName(storageLoc.originalName.trim())
        : path.basename(storageLoc.objectPath);
      const safeName = (hint || 'document.pdf').replace(/[^\w.\- ()\[\]]+/g, '_').slice(0, 200) || 'document.pdf';

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(safeName)}`);
      res.send(buffer);

      logger.info('Document source PDF served from storage', {
        documentId: id,
        bucket: storageLoc.bucket,
        user: getAuthenticatedUserId(req),
      });
      return;
    }

    const sourceArtifact = getDocumentSourceArtifact(document);
    if (!sourceArtifact?.path) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NO_SOURCE_FILE',
          message: 'Không có file PDF gốc trên máy chủ cho tài liệu này',
        },
      });
    }

    const candidates = uniqueResolvedPaths([
      ...remapLegacyKnowledgeBaseCandidates(sourceArtifact.path),
      sourceArtifact.path,
    ]);

    let resolved: { abs: string; downloadName: string } | null = null;
    for (const candidate of candidates) {
      const r = resolveAllowedSourcePdf(candidate, sourceArtifact.originalName);
      if (!r) continue;
      try {
        await fs.access(r.abs);
        resolved = r;
        break;
      } catch {
        /* try next candidate */
      }
    }

    if (!resolved) {
      const anyAllowed = candidates.some((c) => resolveAllowedSourcePdf(c, sourceArtifact.originalName));
      if (!anyAllowed) {
        logger.warn('Rejected document source path (outside allowed roots)', {
          documentId: id,
          path: sourceArtifact.path,
          candidates,
        });
        return res.status(403).json({
          success: false,
          error: { code: 'INVALID_SOURCE_PATH', message: 'Source path is not allowed' },
        });
      }

      logger.warn('Document PDF not on disk (tried all candidates)', {
        documentId: id,
        storedPath: sourceArtifact.path,
        candidates,
      });
      return res.status(404).json({
        success: false,
        error: {
          code: 'SOURCE_MISSING',
          message:
            'Không tìm thấy file PDF trên máy chạy API. Với đường dẫn cũ trong CSDL, hãy tạo đúng thư mục con sau `knowledge_base/` (ví dụ `knowledge_base/downloads/`) trong repo hoặc trong `apps/api/knowledge_base/`, đặt file PDF đúng tên, hoặc tải lại tài liệu bằng nút Tải lên.',
        },
      });
    }

    if (path.resolve(sourceArtifact.path) !== resolved.abs) {
      logger.info('Serving document PDF from local path (remapped or alternate root)', {
        documentId: id,
        storedPath: sourceArtifact.path,
        localPath: resolved.abs,
      });
    }

    const safeName = resolved.downloadName;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(safeName)}`);

    const stream = createReadStream(resolved.abs);
    stream.on('error', (err) => {
      logger.error('Document PDF stream error', { documentId: id, error: err });
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: { code: 'STREAM_ERROR', message: 'Failed to read PDF file' },
        });
      } else {
        res.destroy(err);
      }
    });
    stream.pipe(res);

    logger.info('Document source PDF served', {
      documentId: id,
      user: getAuthenticatedUserId(req),
    });
  } catch (err) {
    logger.error('Document source error', { error: err });
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error',
        },
      });
    }
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

    await removeKnowledgeSourcePdfFromStorage(
      document.metadata as Record<string, unknown> | null | undefined
    );
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

    const candidates = uniqueResolvedPaths([
      ...remapLegacyKnowledgeBaseCandidates(sourceArtifact.path),
      sourceArtifact.path,
    ]);

    let validated: { abs: string; downloadName: string } | null = null;
    for (const candidate of candidates) {
      const r = resolveAllowedSourcePdf(candidate, sourceArtifact.originalName);
      if (!r) continue;
      try {
        await fs.access(r.abs);
        validated = r;
        break;
      } catch {
        /* try next */
      }
    }

    if (!validated) {
      const anyAllowed = candidates.some((c) => resolveAllowedSourcePdf(c, sourceArtifact.originalName));
      if (!anyAllowed) {
        return res.status(403).json({
          error: 'Source path not allowed',
          message: 'Source artifact path is outside allowed knowledge_base / upload directories',
        });
      }
      return res.status(409).json({
        error: 'Source artifact missing',
        message:
          'Cannot reingest: PDF file not found on disk. Place it under knowledge_base/... in the repo or apps/api, or re-upload.',
      });
    }

    const sourceArtifactLocal = { ...sourceArtifact, path: validated.abs };

    logger.info('Starting document reingest', {
      documentId: id,
      title: document.title,
      source: validated.abs,
      user: getAuthenticatedUserId(req),
    });

    const job = ingestionJobStore.createJob(validated.abs);

    ingestionService
      .ingestDocument(validated.abs, {
        chunking: {
          max_tokens: 512,
          overlap_tokens: 50,
        },
        skip_existing: false,
        existingDocumentId: id,
        sourceArtifact: sourceArtifactLocal,
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
