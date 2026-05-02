/**
 * Document Management Routes
 * Admin API for managing knowledge base documents
 */

import { Router } from 'express';
import { supabase } from '../lib/supabase/client.js';
import { authenticateJWT } from '../middleware/auth.js';
import { logger } from '../lib/utils/logger.js';
import { ingestionService } from '../lib/ingestion/service.js';

const router = Router();

/**
 * GET /api/documents
 * List all documents with stats
 */
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const { role } = req.user!;

    // Only admin can access
    if (role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only admin can access document management',
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

    // Get chunk counts for each document
    const documentsWithStats = await Promise.all(
      (documents || []).map(async (doc) => {
        const { count } = await supabase
          .from('chunks')
          .select('*', { count: 'exact', head: true })
          .eq('document_id', doc.id);

        return {
          ...doc,
          chunk_count: count || 0,
        };
      })
    );

    logger.info('Documents listed', {
      count: documentsWithStats.length,
      user: req.user!.id,
    });

    res.json({
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
    const { role } = req.user!;
    const { id } = req.params;

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
      user: req.user!.id,
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
    const { role } = req.user!;
    const { id } = req.params;

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
      .select('id, title')
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
      user: req.user!.id,
    });

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
    const { role } = req.user!;
    const { id } = req.params;

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
      .select('id, title, source')
      .eq('id', id)
      .single();

    if (docError || !document) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Document not found',
      });
    }

    // Check if source file exists
    const fs = await import('fs/promises');
    try {
      await fs.access(document.source);
    } catch {
      return res.status(400).json({
        error: 'Source file not found',
        message: `Cannot reingest: source file ${document.source} does not exist`,
      });
    }

    logger.info('Starting document reingest', {
      documentId: id,
      title: document.title,
      source: document.source,
      user: req.user!.id,
    });

    // Delete existing chunks
    const { error: deleteError } = await supabase
      .from('chunks')
      .delete()
      .eq('document_id', id);

    if (deleteError) {
      logger.error('Failed to delete old chunks', { error: deleteError.message });
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to delete old chunks',
      });
    }

    // Re-ingest document
    // Note: This is async, we return immediately and let it run in background
    ingestionService
      .ingestDocument(document.source, {
        maxTokens: 512,
        overlap: 50,
        force: true, // Force re-ingest
      })
      .then((result) => {
        logger.info('Document reingest completed', {
          documentId: id,
          chunks: result.chunks.length,
          tokens: result.totalTokens,
        });
      })
      .catch((error) => {
        logger.error('Document reingest failed', {
          documentId: id,
          error: error.message,
        });
      });

    res.json({
      success: true,
      message: 'Document reingest started',
      document_id: id,
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

export default router;
