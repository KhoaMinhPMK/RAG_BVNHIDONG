/**
 * Tokenizer Utility
 *
 * Counts tokens for text chunking and cost estimation.
 * Uses tiktoken for accurate token counting.
 */

import { encoding_for_model, Tiktoken } from 'tiktoken';
import { logger } from './logger.js';

// ============================================================================
// Tokenizer Class
// ============================================================================

export class Tokenizer {
  private encoder: Tiktoken | null = null;
  private model: string;

  constructor(model: string = 'gpt-3.5-turbo') {
    this.model = model;
  }

  /**
   * Initialize encoder (lazy loading)
   */
  private getEncoder(): Tiktoken {
    if (!this.encoder) {
      try {
        // Use cl100k_base encoding (compatible with most models)
        this.encoder = encoding_for_model('gpt-3.5-turbo' as any);
        logger.debug('Tokenizer initialized', { model: this.model });
      } catch (error) {
        logger.error('Failed to initialize tokenizer', { error });
        throw new Error('Failed to initialize tokenizer');
      }
    }
    return this.encoder;
  }

  /**
   * Count tokens in text
   */
  countTokens(text: string): number {
    try {
      const encoder = this.getEncoder();
      const tokens = encoder.encode(text);
      return tokens.length;
    } catch (error) {
      logger.error('Token counting failed', { error });
      // Fallback: rough estimate (1 token ≈ 4 characters)
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * Encode text to tokens
   */
  encode(text: string): number[] {
    const encoder = this.getEncoder();
    return Array.from(encoder.encode(text));
  }

  /**
   * Decode tokens to text
   */
  decode(tokens: number[]): string {
    const encoder = this.getEncoder();
    return new TextDecoder().decode(encoder.decode(new Uint32Array(tokens)));
  }

  /**
   * Split text into chunks by token count
   * Returns array of text chunks, each under max_tokens
   */
  splitByTokens(text: string, maxTokens: number, overlap: number = 0): string[] {
    const encoder = this.getEncoder();
    const tokens = encoder.encode(text);
    const chunks: string[] = [];

    let start = 0;
    while (start < tokens.length) {
      const end = Math.min(start + maxTokens, tokens.length);
      const chunkTokens = Array.from(tokens.slice(start, end));
      const chunkBytes = encoder.decode(new Uint32Array(chunkTokens));
      const chunkText = new TextDecoder().decode(chunkBytes);
      chunks.push(chunkText);

      // Move start forward, accounting for overlap
      start = end - overlap;
      if (start >= tokens.length) break;
    }

    return chunks;
  }

  /**
   * Estimate cost for embedding generation
   * Based on typical embedding model pricing
   */
  estimateEmbeddingCost(tokenCount: number, pricePerMillion: number = 0.02): number {
    return (tokenCount / 1_000_000) * pricePerMillion;
  }

  /**
   * Free encoder resources
   */
  free(): void {
    if (this.encoder) {
      this.encoder.free();
      this.encoder = null;
    }
  }
}

// ============================================================================
// Sentence Splitter (for semantic chunking)
// ============================================================================

export class SentenceSplitter {
  /**
   * Split text into sentences
   * Handles common abbreviations and edge cases
   */
  static split(text: string): string[] {
    // Common abbreviations that shouldn't trigger sentence breaks
    const abbreviations = [
      'Dr', 'Mr', 'Mrs', 'Ms', 'Prof', 'Sr', 'Jr',
      'vs', 'etc', 'e.g', 'i.e', 'cf', 'approx',
      'Fig', 'Tab', 'Vol', 'No', 'pp',
    ];

    // Protect abbreviations
    let protectedText = text;
    abbreviations.forEach(abbr => {
      const regex = new RegExp(`\\b${abbr}\\.`, 'g');
      protectedText = protectedText.replace(regex, `${abbr}<PERIOD>`);
    });

    // Split on sentence boundaries
    const sentences = protectedText
      .split(/[.!?]+\s+/)
      .map(s => s.replace(/<PERIOD>/g, '.').trim())
      .filter(s => s.length > 0);

    return sentences;
  }

  /**
   * Group sentences into chunks under max tokens
   */
  static groupByTokens(
    sentences: string[],
    maxTokens: number,
    tokenizer: Tokenizer
  ): string[] {
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentTokens = 0;

    for (const sentence of sentences) {
      const sentenceTokens = tokenizer.countTokens(sentence);

      // If single sentence exceeds max, split it
      if (sentenceTokens > maxTokens) {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.join(' '));
          currentChunk = [];
          currentTokens = 0;
        }
        // Split long sentence by tokens
        const subChunks = tokenizer.splitByTokens(sentence, maxTokens);
        chunks.push(...subChunks);
        continue;
      }

      // Check if adding this sentence would exceed max
      if (currentTokens + sentenceTokens > maxTokens && currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
        currentChunk = [sentence];
        currentTokens = sentenceTokens;
      } else {
        currentChunk.push(sentence);
        currentTokens += sentenceTokens;
      }
    }

    // Add remaining chunk
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
    }

    return chunks;
  }
}

// ============================================================================
// Paragraph Splitter
// ============================================================================

export class ParagraphSplitter {
  /**
   * Split text into paragraphs
   */
  static split(text: string): string[] {
    return text
      .split(/\n\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }

  /**
   * Group paragraphs into chunks under max tokens
   */
  static groupByTokens(
    paragraphs: string[],
    maxTokens: number,
    tokenizer: Tokenizer
  ): string[] {
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentTokens = 0;

    for (const paragraph of paragraphs) {
      const paragraphTokens = tokenizer.countTokens(paragraph);

      // If single paragraph exceeds max, split by sentences
      if (paragraphTokens > maxTokens) {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.join('\n\n'));
          currentChunk = [];
          currentTokens = 0;
        }
        const sentences = SentenceSplitter.split(paragraph);
        const sentenceChunks = SentenceSplitter.groupByTokens(sentences, maxTokens, tokenizer);
        chunks.push(...sentenceChunks);
        continue;
      }

      // Check if adding this paragraph would exceed max
      if (currentTokens + paragraphTokens > maxTokens && currentChunk.length > 0) {
        chunks.push(currentChunk.join('\n\n'));
        currentChunk = [paragraph];
        currentTokens = paragraphTokens;
      } else {
        currentChunk.push(paragraph);
        currentTokens += paragraphTokens;
      }
    }

    // Add remaining chunk
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n\n'));
    }

    return chunks;
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const tokenizer = new Tokenizer();
