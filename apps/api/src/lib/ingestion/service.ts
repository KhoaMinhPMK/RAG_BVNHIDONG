/**
 * Ingestion Service
 *
 * Orchestrates the complete document ingestion pipeline:
 * PDF → Parse → Chunk → Embed → Store in Supabase
 */

import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../supabase/client.js';
import { pdfParser } from './pdf-parser.js';
import { chunker } from './chunker.js';
import { batchEmbeddingProcessor } from '../embedding/batch.js';
import {
  IngestionResult,
  IngestionOptions,
  ParsedDocument,
  DocumentChunk,
  ChunkingOptions,
} from './types.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

// ============================================================================
// Ingestion Service Class
// ============================================================================

export class IngestionService {
  private defaultOptions: Required<IngestionOptions>;

  constructor(options?: IngestionOptions) {
    this.defaultOptions = {
      chunking: options?.chunking || {
        max_tokens: 512,
        overlap_tokens: 50,
        preserve_sentences: true,
        preserve_paragraphs: true,
      },
      embedding_model: options?.embedding_model || 'nomic-embed-text',
      batch_size: options?.batch_size || 10,
      skip_existing: options?.skip_existing ?? true,
    };
  }

  /**
   * Ingest a single document
   */
  async ingestDocument(
    filePath: string,
    options?: Partial<IngestionOptions>
  ): Promise<IngestionResult> {
    const startTime = Date.now();
    const opts = { ...this.defaultOptions, ...options };

    logger.info('Starting document ingestion', { filePath });

    try {
      // Step 1: Parse PDF
      logger.info('Step 1/5: Parsing PDF...');
      const parsed = await pdfParser.parsePDF(filePath);
      const contentHash = pdfParser.calculateContentHash(parsed.content);

      // Check if document already exists
      if (opts.skip_existing) {
        const existing = await this.checkExisting(contentHash);
        if (existing) {
          logger.info('Document already exists, skipping', {
            documentId: existing.id,
            contentHash,
          });
          return {
            success: true,
            document_id: existing.id,
            chunks_created: 0,
            embeddings_created: 0,
            total_tokens: 0,
            duration_ms: Date.now() - startTime,
          };
        }
      }

      // Step 2: Insert document record
      logger.info('Step 2/5: Creating document record...');
      const documentId = await this.insertDocumentRecord(parsed, contentHash);

      // Step 3: Chunk document
      logger.info('Step 3/5: Chunking document...');
      const chunks = chunker.chunkDocument(parsed, documentId);

      // Validate chunks
      const warnings = chunker.validateChunks(chunks);
      if (warnings.length > 0) {
        logger.warn('Chunk validation warnings', { documentId, warnings });
      }

      // Step 4: Generate embeddings
      logger.info('Step 4/5: Generating embeddings...');
      const embedResults = await batchEmbeddingProcessor.embedChunks(chunks);

      // Step 5: Store chunks in Supabase
      logger.info('Step 5/5: Storing chunks in database...');
      await this.storeChunks(embedResults);

      const duration = Date.now() - startTime;

      logger.info('Document ingestion complete', {
        documentId,
        filePath,
        duration: `${duration}ms`,
        chunksCreated: chunks.length,
      });

      return {
        success: true,
        document_id: documentId,
        chunks_created: chunks.length,
        embeddings_created: embedResults.length,
        total_tokens: embedResults.reduce(
          (sum, r) => sum + r.chunk.metadata.token_count,
          0
        ),
        duration_ms: duration,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Document ingestion failed', { filePath, error: errorMsg });

      return {
        success: false,
        document_id: '',
        chunks_created: 0,
        embeddings_created: 0,
        total_tokens: 0,
        duration_ms: Date.now() - startTime,
        error: errorMsg,
      };
    }
  }

  /**
   * Ingest multiple documents
   */
  async ingestBatch(
    filePaths: string[],
    options?: Partial<IngestionOptions>
  ): Promise<Array<{ filePath: string; result: IngestionResult }>> {
    logger.info('Starting batch ingestion', { fileCount: filePaths.length });

    const results: Array<{ filePath: string; result: IngestionResult }> = [];

    for (const filePath of filePaths) {
      logger.info(`Ingesting [${results.length + 1}/${filePaths.length}]`, { filePath });

      const result = await this.ingestDocument(filePath, options);
      results.push({ filePath, result });

      // Log progress
      logger.info(`Progress: [${results.length}/${filePaths.length}] ${result.success ? '✅' : '❌'} ${filePath}`);
    }

    const successCount = results.filter(r => r.result.success).length;
    logger.info('Batch ingestion complete', {
      total: filePaths.length,
      success: successCount,
      failed: filePaths.length - successCount,
    });

    return results;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Check if document already exists (by content hash)
   */
  private async checkExisting(contentHash: string): Promise<{ id: string } | null> {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id')
        .eq('checksum', contentHash)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - document doesn't exist
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Check existing failed', { error });
      return null;
    }
  }

  /**
   * Insert document record into Supabase
   */
  private async insertDocumentRecord(
    parsed: ParsedDocument,
    contentHash: string
  ): Promise<string> {
    const documentId = uuidv4();

    const { error } = await supabase.from('documents').insert({
      id: documentId,
      title: parsed.metadata.title,
      version: parsed.metadata.version,
      effective_date: parsed.metadata.effective_date,
      source: parsed.metadata.source,
      owner: parsed.metadata.institution || 'System',
      age_group: 'pediatric',
      status: 'active',
      language: 'vi',
      access_level: 'clinician',
      checksum: contentHash,
    });

    if (error) {
      logger.error('Failed to insert document record', { error });
      throw new Error(`Failed to insert document: ${error.message}`);
    }

    logger.info('Document record created', { documentId, title: parsed.metadata.title });
    return documentId;
  }

  /**
   * Store chunks with embeddings in Supabase
   */
  private async storeChunks(
    embedResults: Array<{ chunk: DocumentChunk; embedding: number[] }>
  ): Promise<void> {
    const chunkRows = embedResults.map(({ chunk, embedding }) => ({
      id: uuidv4(),
      document_id: chunk.metadata.document_id,
      chunk_index: chunk.metadata.chunk_index,
      content: chunk.content,
      embedding,
      effective_date: new Date().toISOString().split('T')[0],
      metadata: {
        token_count: chunk.metadata.token_count,
        total_chunks: chunk.metadata.total_chunks,
      },
    }));

    // Insert in batches to avoid payload size limits
    const batchSize = 50;
    for (let i = 0; i < chunkRows.length; i += batchSize) {
      const batch = chunkRows.slice(i, i + batchSize);

      const { error } = await supabase.from('chunks').insert(batch);

      if (error) {
        logger.error('Failed to insert chunks', {
          batchStart: i,
          batchSize: batch.length,
          error: error.message,
        });
        throw new Error(`Failed to insert chunks: ${error.message}`);
      }
    }

    logger.info('Chunks stored successfully', { totalChunks: chunkRows.length });
  }

  /**
   * Delete document and its chunks
   */
  async deleteDocument(documentId: string): Promise<boolean> {
    logger.info('Deleting document', { documentId });

    // Delete chunks first
    const { error: chunksError } = await supabase
      .from('chunks')
      .delete()
      .eq('document_id', documentId);

    if (chunksError) {
      logger.error('Failed to delete chunks', { error: chunksError.message });
      return false;
    }

    // Delete document
    const { error: docError } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (docError) {
      logger.error('Failed to delete document', { error: docError.message });
      return false;
    }

    logger.info('Document deleted', { documentId });
    return true;
  }

  /**
   * Re-ingest a document (delete old, insert new)
   */
  async reingestDocument(
    documentId: string,
    filePath: string,
    options?: Partial<IngestionOptions>
  ): Promise<IngestionResult> {
    logger.info('Re-ingesting document', { documentId, filePath });

    // Delete existing chunks
    await this.deleteDocument(documentId);

    // Ingest fresh
    return this.ingestDocument(filePath, options);
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const ingestionService = new IngestionService();
