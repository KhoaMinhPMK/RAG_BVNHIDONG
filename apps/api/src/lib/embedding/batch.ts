/**
 * Batch Embedding Processor
 *
 * Handles batch embedding generation with progress tracking,
 * rate limiting, and error recovery.
 */

import { BatchEmbeddingRequest, BatchEmbeddingResponse, DocumentChunk } from '../ingestion/types.js';
import { embeddingClient } from './client.js';
import { logger } from '../utils/logger.js';
import cliProgress from 'cli-progress';

// ============================================================================
// Batch Processor Class
// ============================================================================

export class BatchEmbeddingProcessor {
  private batchSize: number;
  private delayMs: number;
  private maxRetries: number;

  constructor(
    batchSize: number = 10,
    delayMs: number = 100,
    maxRetries: number = 3
  ) {
    this.batchSize = batchSize;
    this.delayMs = delayMs;
    this.maxRetries = maxRetries;
  }

  /**
   * Generate embeddings for multiple texts with progress tracking
   */
  async generateBatch(
    texts: string[],
    showProgress: boolean = true
  ): Promise<BatchEmbeddingResponse> {
    logger.info('Starting batch embedding generation', {
      totalTexts: texts.length,
      batchSize: this.batchSize,
    });

    const embeddings: number[][] = [];
    const failedIndices: number[] = [];
    let totalTokens = 0;

    // Create progress bar
    const progressBar = showProgress
      ? new cliProgress.SingleBar({
          format: 'Embedding Progress |{bar}| {percentage}% | {value}/{total} chunks',
          barCompleteChar: '█',
          barIncompleteChar: '░',
          hideCursor: true,
        })
      : null;

    if (progressBar) {
      progressBar.start(texts.length, 0);
    }

    // Process in batches
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, Math.min(i + this.batchSize, texts.length));
      const batchResults = await this.processBatch(batch, i);

      embeddings.push(...batchResults.embeddings);
      failedIndices.push(...batchResults.failedIndices);
      totalTokens += batchResults.totalTokens;

      if (progressBar) {
        progressBar.update(i + batch.length);
      }

      // Rate limiting delay between batches
      if (i + this.batchSize < texts.length) {
        await this.sleep(this.delayMs);
      }
    }

    if (progressBar) {
      progressBar.stop();
    }

    logger.info('Batch embedding generation complete', {
      totalTexts: texts.length,
      successful: embeddings.length,
      failed: failedIndices.length,
      totalTokens,
    });

    return {
      embeddings,
      model: 'nomic-embed-text',
      total_tokens: totalTokens,
      failed_indices: failedIndices.length > 0 ? failedIndices : undefined,
    };
  }

  /**
   * Process a single batch of texts
   */
  private async processBatch(
    texts: string[],
    startIndex: number
  ): Promise<{
    embeddings: number[][];
    failedIndices: number[];
    totalTokens: number;
  }> {
    const embeddings: number[][] = [];
    const failedIndices: number[] = [];
    let totalTokens = 0;

    // Process each text in the batch
    const promises = texts.map(async (text, batchIdx) => {
      const globalIdx = startIndex + batchIdx;

      for (let attempt = 0; attempt < this.maxRetries; attempt++) {
        try {
          const result = await embeddingClient.generateEmbedding(text);
          return {
            success: true,
            embedding: result.embedding,
            tokens: result.token_count,
            index: globalIdx,
          };
        } catch (error) {
          logger.warn('Embedding generation failed, retrying', {
            index: globalIdx,
            attempt: attempt + 1,
            error: error instanceof Error ? error.message : 'Unknown error',
          });

          if (attempt < this.maxRetries - 1) {
            await this.sleep(1000 * (attempt + 1)); // Exponential backoff
          }
        }
      }

      // All retries failed
      logger.error('Embedding generation failed after all retries', {
        index: globalIdx,
      });

      return {
        success: false,
        embedding: [],
        tokens: 0,
        index: globalIdx,
      };
    });

    const results = await Promise.all(promises);

    for (const result of results) {
      if (result.success) {
        embeddings.push(result.embedding);
        totalTokens += result.tokens;
      } else {
        failedIndices.push(result.index);
      }
    }

    return { embeddings, failedIndices, totalTokens };
  }

  /**
   * Generate embeddings for document chunks
   */
  async embedChunks(
    chunks: DocumentChunk[],
    showProgress: boolean = true
  ): Promise<Array<{ chunk: DocumentChunk; embedding: number[] }>> {
    logger.info('Embedding document chunks', { count: chunks.length });

    const texts = chunks.map(c => c.content);
    const batchResult = await this.generateBatch(texts, showProgress);

    if (batchResult.failed_indices && batchResult.failed_indices.length > 0) {
      logger.warn('Some chunks failed to embed', {
        failedCount: batchResult.failed_indices.length,
        failedIndices: batchResult.failed_indices,
      });
    }

    // Combine chunks with their embeddings
    const results: Array<{ chunk: DocumentChunk; embedding: number[] }> = [];

    for (let i = 0; i < chunks.length; i++) {
      if (batchResult.embeddings[i]) {
        results.push({
          chunk: chunks[i],
          embedding: batchResult.embeddings[i],
        });
      }
    }

    logger.info('Chunk embedding complete', {
      totalChunks: chunks.length,
      successfulEmbeddings: results.length,
    });

    return results;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Estimate time for batch processing
   */
  estimateTime(textCount: number, avgTimePerText: number = 200): number {
    const batches = Math.ceil(textCount / this.batchSize);
    const processingTime = textCount * avgTimePerText;
    const delayTime = (batches - 1) * this.delayMs;
    return processingTime + delayTime;
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const batchEmbeddingProcessor = new BatchEmbeddingProcessor();
