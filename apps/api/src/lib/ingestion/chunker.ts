/**
 * Document Chunker
 *
 * Splits documents into semantic chunks for embedding.
 * Preserves sentence/paragraph boundaries for better context.
 */

import { DocumentChunk, ChunkingOptions, ParsedDocument } from './types.js';
import { tokenizer, SentenceSplitter, ParagraphSplitter } from '../utils/tokenizer.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

// ============================================================================
// Default Chunking Options
// ============================================================================

const DEFAULT_OPTIONS: ChunkingOptions = {
  max_tokens: 512,
  overlap_tokens: 50,
  preserve_sentences: true,
  preserve_paragraphs: true,
};

// ============================================================================
// Text Normalization
// ============================================================================

/**
 * Normalizes text to ensure safe tokenization.
 * Handles common issues from PDF extraction:
 * - Non-printable control characters
 * - Invalid or surrogate Unicode
 * - Excessive whitespace
 * - Zero-width characters
 *
 * This prevents tiktoken from failing on edge-case characters
 * found in medical/scientific PDFs.
 */
function cleanText(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    // Normalize Unicode to NFC form (composed) to ensure consistent encoding
    .normalize('NFC')
    // Remove zero-width characters that can confuse tokenizers
    .replace(/[​-‍﻿]/g, '')
    // Remove other invisible control characters (keep newlines/tabs)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize line endings to Unix style
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Collapse multiple spaces into single space (preserve paragraph breaks)
    .replace(/[^\S\n]+/g, ' ')
    // Remove trailing/leading whitespace on each line while preserving structure
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    // Collapse multiple blank lines into a single paragraph break
    .replace(/\n{3,}/g, '\n\n')
    // Final trim
    .trim();
}

// ============================================================================
// Chunker Class
// ============================================================================

export class Chunker {
  private options: ChunkingOptions;

  constructor(options: Partial<ChunkingOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Chunk a parsed document into smaller pieces.
   * If the document has extracted sections, chunk per-section so heading
   * context travels with each chunk.  Otherwise fall back to flat chunking.
   */
  chunkDocument(document: ParsedDocument, documentId: string): DocumentChunk[] {
    logger.info('Chunking document', {
      documentId,
      title: document.metadata.title,
      contentLength: document.content.length,
      sectionCount: document.sections?.length ?? 0,
      options: this.options,
    });

    const documentChunks: DocumentChunk[] =
      document.sections && document.sections.length > 1
        ? this.chunkBySections(document, documentId)
        : this.chunkFlat(document, documentId);

    logger.info('Document chunked successfully', {
      documentId,
      totalChunks: documentChunks.length,
      avgTokens: Math.round(
        documentChunks.reduce((sum, c) => sum + c.metadata.token_count, 0) /
          Math.max(documentChunks.length, 1)
      ),
    });

    return documentChunks;
  }

  /**
   * Section-aware chunking: each section is chunked independently so that
   * the section heading is always preserved as contextual metadata.
   * A contextual prefix (document title + section heading) is prepended to
   * the *embedded* text to improve vector similarity quality.
   */
  private chunkBySections(document: ParsedDocument, documentId: string): DocumentChunk[] {
    const allChunks: DocumentChunk[] = [];
    let globalIndex = 0;

    const sections = document.sections!;
    const totalSections = sections.length;

    // First pass: collect all raw chunks from all sections
    const sectionChunks: Array<{ sectionIdx: number; rawChunks: string[] }> = sections.map(
      (section, sectionIdx) => ({
        sectionIdx,
        rawChunks: this.createChunks(section.content),
      })
    );

    const totalChunks = sectionChunks.reduce((s, c) => s + c.rawChunks.length, 0);

    for (const { sectionIdx, rawChunks } of sectionChunks) {
      const section = sections[sectionIdx];
      const headingHierarchy = this.buildHeadingHierarchy(sections, sectionIdx);

      // Context prefix that rides alongside the chunk for better embeddings
      const contextPrefix = `[Tài liệu: ${document.metadata.title} | Phần: ${section.heading}]`;

      for (const rawContent of rawChunks) {
        // The stored content is plain so it renders cleanly in the UI
        // context_prefix is stored separately and prepended only at embedding time
        allChunks.push({
          content: rawContent,
          metadata: {
            document_id: documentId,
            chunk_index: globalIndex,
            total_chunks: totalChunks,
            section_title: section.heading,
            start_page: section.page_estimate,
            token_count: tokenizer.countTokens(rawContent),
            heading_hierarchy: headingHierarchy,
            context_prefix: contextPrefix,
          },
        });
        globalIndex++;
      }
    }

    return allChunks;
  }

  /**
   * Build the heading breadcrumb for a section by looking at ancestor headings.
   */
  private buildHeadingHierarchy(
    sections: ParsedDocument['sections'] & {},
    currentIdx: number
  ): string[] {
    const current = sections[currentIdx];
    const hierarchy: string[] = [];

    for (let i = currentIdx - 1; i >= 0; i--) {
      if (sections[i].level < current.level) {
        hierarchy.unshift(sections[i].heading);
        if (sections[i].level === 1) break;
      }
    }

    hierarchy.push(current.heading);
    return hierarchy;
  }

  /**
   * Flat (legacy) chunking for documents without section structure.
   */
  private chunkFlat(document: ParsedDocument, documentId: string): DocumentChunk[] {
    const chunks = this.createChunks(document.content);
    const contextPrefix = `[Tài liệu: ${document.metadata.title}]`;

    return chunks.map((content, index) => ({
      content,
      metadata: {
        document_id: documentId,
        chunk_index: index,
        total_chunks: chunks.length,
        token_count: tokenizer.countTokens(content),
        context_prefix: contextPrefix,
      },
    }));
  }

  /**
   * Create chunks from text content
   * Normalizes text before tokenization to handle edge cases from PDF extraction
   */
  private createChunks(content: string): string[] {
    // Normalize text to prevent tiktoken failures on special characters
    // This handles control chars, surrogate pairs, and Unicode edge cases
    const normalizedContent = cleanText(content);

    const { max_tokens, preserve_paragraphs, preserve_sentences } = this.options;
    const overlap_tokens = this.getSafeOverlapTokens(max_tokens);
    const contentMaxTokens = overlap_tokens > 0 ? max_tokens - overlap_tokens : max_tokens;

    // Strategy 1: Preserve paragraphs (best for structured documents)
    if (preserve_paragraphs) {
      const paragraphs = ParagraphSplitter.split(normalizedContent);
      const chunks = ParagraphSplitter.groupByTokens(paragraphs, contentMaxTokens, tokenizer);

      if (overlap_tokens > 0) {
        return this.addOverlap(chunks, overlap_tokens);
      }

      return chunks;
    }

    // Strategy 2: Preserve sentences (good for flowing text)
    if (preserve_sentences) {
      const sentences = SentenceSplitter.split(normalizedContent);
      const chunks = SentenceSplitter.groupByTokens(sentences, contentMaxTokens, tokenizer);

      if (overlap_tokens > 0) {
        return this.addOverlap(chunks, overlap_tokens);
      }

      return chunks;
    }

    // Strategy 3: Simple token-based splitting (fallback)
    return tokenizer.splitByTokens(normalizedContent, max_tokens, overlap_tokens);
  }

  /**
   * Reserve token budget for overlap so prepending context doesn't push
   * the final chunk beyond the configured max token size.
   */
  private getSafeOverlapTokens(maxTokens: number): number {
    const requestedOverlap = Math.max(0, this.options.overlap_tokens);
    return Math.min(requestedOverlap, Math.max(maxTokens - 1, 0));
  }

  /**
   * Add overlap between chunks
   * Takes last N tokens from previous chunk and prepends to next chunk
   */
  private addOverlap(chunks: string[], overlapTokens: number): string[] {
    if (chunks.length <= 1 || overlapTokens === 0) {
      return chunks;
    }

    const overlappedChunks: string[] = [chunks[0]];

    for (let i = 1; i < chunks.length; i++) {
      const prevChunk = chunks[i - 1];
      const currentChunk = chunks[i];

      // Get last N tokens from previous chunk
      const prevTokens = tokenizer.encode(prevChunk);
      const overlapStart = Math.max(0, prevTokens.length - overlapTokens);
      const overlapTokensArray = prevTokens.slice(overlapStart);
      const overlapText = tokenizer.decode(overlapTokensArray);

      // Prepend overlap to current chunk
      const overlappedChunk = overlapText + ' ' + currentChunk;
      overlappedChunks.push(overlappedChunk);
    }

    return overlappedChunks;
  }

  /**
   * Validate chunk quality
   * Returns warnings if chunks are too small/large or have issues
   */
  validateChunks(chunks: DocumentChunk[]): string[] {
    const warnings: string[] = [];

    // Check if any chunks are too small (< 50 tokens)
    const tooSmall = chunks.filter(c => c.metadata.token_count < 50);
    if (tooSmall.length > 0) {
      warnings.push(`${tooSmall.length} chunks are very small (< 50 tokens)`);
    }

    // Check if any chunks exceed max tokens
    const tooLarge = chunks.filter(c => c.metadata.token_count > this.options.max_tokens);
    if (tooLarge.length > 0) {
      warnings.push(`${tooLarge.length} chunks exceed max tokens (${this.options.max_tokens})`);
    }

    // Check if chunks are too uniform (might indicate poor splitting)
    const tokenCounts = chunks.map(c => c.metadata.token_count);
    const avgTokens = tokenCounts.reduce((a, b) => a + b, 0) / tokenCounts.length;
    const variance = tokenCounts.reduce((sum, count) => sum + Math.pow(count - avgTokens, 2), 0) / tokenCounts.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev < 10 && chunks.length > 5) {
      warnings.push('Chunks are very uniform - consider adjusting chunking strategy');
    }

    return warnings;
  }

  /**
   * Batch chunk multiple documents
   */
  batchChunk(documents: Array<{ parsed: ParsedDocument; id: string }>): DocumentChunk[] {
    logger.info('Batch chunking documents', { count: documents.length });

    const allChunks: DocumentChunk[] = [];

    for (const { parsed, id } of documents) {
      try {
        const chunks = this.chunkDocument(parsed, id);
        allChunks.push(...chunks);
      } catch (error) {
        logger.error('Failed to chunk document', { documentId: id, error });
      }
    }

    logger.info('Batch chunking complete', {
      totalDocuments: documents.length,
      totalChunks: allChunks.length,
    });

    return allChunks;
  }
}

// ============================================================================
// Export singleton instance with default options
// ============================================================================

export const chunker = new Chunker();

// ============================================================================
// Helper: Create custom chunker with specific options
// ============================================================================

export function createChunker(options: Partial<ChunkingOptions>): Chunker {
  return new Chunker(options);
}
