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
  DocumentMetadata,
  IngestionProgressUpdate,
} from './types.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';
import {
  isKnowledgePdfStorageUploadEnabled,
  uploadKnowledgeSourcePdfAfterIngest,
} from '../supabase/knowledge-pdf-storage.js';

// ============================================================================
// Ingestion Service Class
// ============================================================================

export class IngestionService {
  private defaultOptions: {
    chunking: ChunkingOptions;
    embedding_model: string;
    batch_size: number;
    skip_existing: boolean;
    metadataOverride?: Partial<DocumentMetadata>;
  };

  constructor(options?: IngestionOptions) {
    this.defaultOptions = {
      chunking: {
        max_tokens: options?.chunking?.max_tokens ?? 512,
        overlap_tokens: options?.chunking?.overlap_tokens ?? 50,
        preserve_sentences: options?.chunking?.preserve_sentences ?? true,
        preserve_paragraphs: options?.chunking?.preserve_paragraphs ?? true,
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
    const opts = {
      ...this.defaultOptions,
      ...options,
      chunking: {
        ...this.defaultOptions.chunking,
        ...options?.chunking,
      },
    };

    logger.info('Starting document ingestion', { filePath });

    try {
      // Step 1: Parse PDF
      await this.reportProgress(opts.progressCallback, {
        status: 'parsing',
        progress: 5,
        message: 'Đang đọc và trích xuất nội dung PDF',
      });
      logger.info('Step 1/5: Parsing PDF...');
      let parsed = await pdfParser.parsePDF(filePath);

      if (opts.metadataOverride) {
        parsed = {
          ...parsed,
          metadata: {
            ...parsed.metadata,
            ...opts.metadataOverride,
          },
        };
      }

      const contentHash = pdfParser.calculateContentHash(parsed.content);

      // Check if document already exists
      if (opts.skip_existing && !opts.existingDocumentId) {
        const existing = await this.checkExisting(contentHash);
        if (existing) {
          logger.info('Document already exists, skipping', {
            documentId: existing.id,
            contentHash,
          });
          await this.reportProgress(opts.progressCallback, {
            status: 'completed',
            progress: 100,
            document_id: existing.id,
            message: 'Tài liệu đã tồn tại, bỏ qua ingest mới',
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
      const documentId = await this.upsertDocumentRecord(parsed, contentHash, opts);
      await this.reportProgress(opts.progressCallback, {
        status: 'chunking',
        progress: 25,
        document_id: documentId,
        message: 'Đang chia tài liệu thành các chunk semantic',
      });

      // Step 3: Chunk document
      logger.info('Step 3/5: Chunking document...');
      const chunks = chunker.chunkDocument(parsed, documentId);

      // Validate chunks
      const warnings = chunker.validateChunks(chunks);
      if (warnings.length > 0) {
        logger.warn('Chunk validation warnings', { documentId, warnings });
      }

      await this.reportProgress(opts.progressCallback, {
        status: 'embedding',
        progress: 45,
        document_id: documentId,
        total_chunks: chunks.length,
        processed_chunks: 0,
        message: `Đang tạo embedding cho ${chunks.length} chunk`,
      });

      // Step 4: Generate embeddings
      logger.info('Step 4/5: Generating embeddings...');
      const embedResults = await batchEmbeddingProcessor.embedChunks(
        chunks,
        false,
        async (processed, total) => {
          const progress = 45 + Math.round((processed / Math.max(total, 1)) * 30);
          await this.reportProgress(opts.progressCallback, {
            status: 'embedding',
            progress,
            document_id: documentId,
            total_chunks: total,
            processed_chunks: processed,
            message: `Đã tạo embedding ${processed}/${total} chunk`,
          });
        }
      );

      await this.reportProgress(opts.progressCallback, {
        status: 'storing',
        progress: 78,
        document_id: documentId,
        total_chunks: embedResults.length,
        processed_chunks: 0,
        message: 'Đang lưu chunks và embeddings vào database',
      });

      // Step 5: Store chunks in Supabase
      logger.info('Step 5/5: Storing chunks in database...');
      await this.storeChunks(documentId, embedResults, {
        replaceExisting: Boolean(opts.existingDocumentId),
        onProgress: async (processed, total) => {
          const progress = 78 + Math.round((processed / Math.max(total, 1)) * 21);
          await this.reportProgress(opts.progressCallback, {
            status: 'storing',
            progress,
            document_id: documentId,
            total_chunks: total,
            processed_chunks: processed,
            message: `Đã lưu ${processed}/${total} chunk vào database`,
          });
        },
      });

      const wantStorage =
        opts.uploadSourcePdfToStorage !== false && isKnowledgePdfStorageUploadEnabled();
      if (wantStorage) {
        try {
          await uploadKnowledgeSourcePdfAfterIngest(
            documentId,
            filePath,
            opts.sourceArtifact?.original_name
          );
        } catch (storageErr) {
          logger.warn('PDF storage upload failed after successful ingest', {
            documentId,
            filePath,
            error: storageErr instanceof Error ? storageErr.message : String(storageErr),
          });
        }
      }

      const duration = Date.now() - startTime;

      await this.reportProgress(opts.progressCallback, {
        status: 'completed',
        progress: 100,
        document_id: documentId,
        total_chunks: embedResults.length,
        processed_chunks: embedResults.length,
        message: 'Hoàn tất ingest tài liệu',
      });

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
      await this.reportProgress(opts.progressCallback, {
        status: 'failed',
        progress: 0,
        message: errorMsg,
      });

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
   * Create or update document record in Supabase
   */
  private async upsertDocumentRecord(
    parsed: ParsedDocument,
    contentHash: string,
    options: {
      existingDocumentId?: string;
      metadataPatch?: Record<string, any>;
      sourceArtifact?: { path: string; original_name?: string; managed?: boolean };
    }
  ): Promise<string> {
    const metadataPatch = {
      ...(options.metadataPatch ?? {}),
      ...(options.sourceArtifact
        ? {
            source_artifact_path: options.sourceArtifact.path,
            source_artifact_original_name: options.sourceArtifact.original_name,
            source_artifact_managed: options.sourceArtifact.managed ?? false,
          }
        : {}),
    };

    if (options.existingDocumentId) {
      const { data: existingDocument, error: existingError } = await supabase
        .from('documents')
        .select('metadata')
        .eq('id', options.existingDocumentId)
        .single();

      if (existingError) {
        logger.error('Failed to load existing document metadata', {
          documentId: options.existingDocumentId,
          error: existingError.message,
        });
        throw new Error(`Failed to load existing document metadata: ${existingError.message}`);
      }

      const { error } = await supabase
        .from('documents')
        .update({
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
          metadata: {
            ...((existingDocument?.metadata as Record<string, any> | undefined) ?? {}),
            ...metadataPatch,
          },
        })
        .eq('id', options.existingDocumentId);

      if (error) {
        logger.error('Failed to update document record', { error });
        throw new Error(`Failed to update document: ${error.message}`);
      }

      logger.info('Document record updated', {
        documentId: options.existingDocumentId,
        title: parsed.metadata.title,
      });
      return options.existingDocumentId;
    }

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
      metadata: metadataPatch,
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
    documentId: string,
    embedResults: Array<{ chunk: DocumentChunk; embedding: number[] }>,
    options?: {
      replaceExisting?: boolean;
      onProgress?: (processed: number, total: number) => void | Promise<void>;
    }
  ): Promise<void> {
    if (options?.replaceExisting) {
      const { error: deleteError } = await supabase
        .from('chunks')
        .delete()
        .eq('document_id', documentId);

      if (deleteError) {
        logger.error('Failed to replace existing chunks', {
          documentId,
          error: deleteError.message,
        });
        throw new Error(`Failed to replace existing chunks: ${deleteError.message}`);
      }
    }

    const chunkRows = embedResults.map(({ chunk, embedding }) => ({
      id: uuidv4(),
      document_id: documentId,
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
    let processed = 0;
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

      processed += batch.length;
      await options?.onProgress?.(processed, chunkRows.length);
    }

    logger.info('Chunks stored successfully', { totalChunks: chunkRows.length });
  }

  private async reportProgress(
    progressCallback: IngestionOptions['progressCallback'],
    update: IngestionProgressUpdate
  ): Promise<void> {
    if (!progressCallback) {
      return;
    }

    await progressCallback(update);
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
