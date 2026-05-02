/**
 * Embedding Client
 *
 * Generates embeddings using Ollama's nomic-embed-text model.
 * Handles single and batch embedding requests.
 */

import { EmbeddingRequest, EmbeddingResponse } from '../ingestion/types.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// Embedding Client Class
// ============================================================================

export class EmbeddingClient {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl?: string, model?: string) {
    // Read from env vars inside constructor body (not default params)
    this.baseUrl = baseUrl || process.env.OLLAMA_URL || 'http://localhost:11434';
    this.model = model || process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';

    logger.info('EmbeddingClient initialized', {
      baseUrl: this.baseUrl,
      model: this.model,
    });
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<EmbeddingResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: text,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();

      if (!data.embedding || !Array.isArray(data.embedding)) {
        throw new Error('Invalid embedding response from Ollama');
      }

      return {
        embedding: data.embedding,
        model: this.model,
        token_count: text.split(/\s+/).length, // Rough estimate
      };
    } catch (error) {
      logger.error('Embedding generation failed', {
        model: this.model,
        textLength: text.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Test connection to Ollama embedding service
   */
  async testConnection(): Promise<boolean> {
    try {
      logger.info('Testing embedding connection', {
        baseUrl: this.baseUrl,
        model: this.model,
      });

      const testText = 'test connection';
      const response = await this.generateEmbedding(testText);

      if (response.embedding.length > 0) {
        logger.info('✅ Embedding connection successful', {
          baseUrl: this.baseUrl,
          model: this.model,
          embeddingDim: response.embedding.length,
        });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Embedding connection test failed', {
        baseUrl: this.baseUrl,
        model: this.model,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get embedding dimension for this model
   */
  async getEmbeddingDimension(): Promise<number> {
    try {
      const response = await this.generateEmbedding('test');
      return response.embedding.length;
    } catch (error) {
      logger.error('Failed to get embedding dimension', { error });
      // Default for nomic-embed-text
      return 768;
    }
  }
}

// ============================================================================
// Lazy singleton instance
// ============================================================================

let _embeddingClient: EmbeddingClient | null = null;

export const embeddingClient = new Proxy({} as EmbeddingClient, {
  get(target, prop) {
    if (!_embeddingClient) {
      _embeddingClient = new EmbeddingClient();
    }
    const value = (_embeddingClient as any)[prop];
    return typeof value === 'function' ? value.bind(_embeddingClient) : value;
  },
});
