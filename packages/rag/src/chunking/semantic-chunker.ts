/**
 * Semantic chunker cho medical documents
 * Chunk size: 768 tokens (điều chỉnh từ 512 theo architect review)
 * Overlap: 192 tokens (25% overlap)
 * Preserve metadata: section, page, heading
 */

export interface ChunkMetadata {
  page?: number;
  section?: string;
  heading?: string;
  tokens?: number;
}

export interface DocumentChunk {
  content: string;
  index: number;
  metadata: ChunkMetadata;
}

export interface ChunkingOptions {
  chunkSize?: number; // tokens
  overlap?: number; // tokens
  preserveSections?: boolean; // Có tách theo section không
}

const DEFAULT_CHUNK_SIZE = 768;
const DEFAULT_OVERLAP = 192;

/**
 * Simple tokenizer (word-based approximation)
 * Thực tế nên dùng tiktoken hoặc tokenizer của model
 * Tạm thời dùng word count * 1.3 để estimate tokens
 */
function estimateTokens(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.ceil(words * 1.3); // Rough estimate
}

/**
 * Tokenize text thành array of tokens (simplified)
 */
function tokenize(text: string): string[] {
  // Simplified: split by whitespace
  // TODO: Use proper tokenizer (tiktoken, transformers.js)
  return text.trim().split(/\s+/);
}

/**
 * Detokenize array of tokens back to text
 */
function detokenize(tokens: string[]): string {
  return tokens.join(' ');
}

/**
 * Split text by sections (headings)
 * Detect markdown headings: #, ##, ###
 * Detect numbered sections: 1., 2., 3.
 */
function splitBySections(text: string): Array<{
  heading: string | null;
  content: string;
  startIndex: number;
}> {
  const sections: Array<{ heading: string | null; content: string; startIndex: number }> = [];

  // Regex để detect headings
  const headingRegex = /^(#{1,6}\s+.+|^\d+\.\s+.+|^[A-Z][^.!?]*:)$/gm;

  let lastIndex = 0;
  let lastHeading: string | null = null;
  let match;

  while ((match = headingRegex.exec(text)) !== null) {
    // Add previous section
    if (match.index > lastIndex) {
      const content = text.slice(lastIndex, match.index).trim();
      if (content) {
        sections.push({
          heading: lastHeading,
          content,
          startIndex: lastIndex,
        });
      }
    }

    lastHeading = match[0].trim();
    lastIndex = match.index + match[0].length;
  }

  // Add final section
  const finalContent = text.slice(lastIndex).trim();
  if (finalContent) {
    sections.push({
      heading: lastHeading,
      content: finalContent,
      startIndex: lastIndex,
    });
  }

  // Nếu không có sections, return toàn bộ text
  if (sections.length === 0) {
    sections.push({
      heading: null,
      content: text.trim(),
      startIndex: 0,
    });
  }

  return sections;
}

/**
 * Chunk document với semantic awareness
 */
export function chunkDocument(
  text: string,
  documentMetadata: { page?: number } = {},
  options: ChunkingOptions = {}
): DocumentChunk[] {
  const {
    chunkSize = DEFAULT_CHUNK_SIZE,
    overlap = DEFAULT_OVERLAP,
    preserveSections = true,
  } = options;

  const chunks: DocumentChunk[] = [];

  if (!text || text.trim().length === 0) {
    return chunks;
  }

  // Split by sections nếu enabled
  const sections = preserveSections ? splitBySections(text) : [
    { heading: null, content: text, startIndex: 0 }
  ];

  let globalChunkIndex = 0;

  for (const section of sections) {
    const tokens = tokenize(section.content);

    // Nếu section nhỏ hơn chunk size, giữ nguyên
    if (tokens.length <= chunkSize) {
      chunks.push({
        content: section.content,
        index: globalChunkIndex++,
        metadata: {
          page: documentMetadata.page,
          section: section.heading || undefined,
          heading: section.heading || undefined,
          tokens: tokens.length,
        },
      });
      continue;
    }

    // Chia section thành chunks với overlap
    for (let i = 0; i < tokens.length; i += chunkSize - overlap) {
      const chunkTokens = tokens.slice(i, i + chunkSize);
      const chunkContent = detokenize(chunkTokens);

      chunks.push({
        content: chunkContent,
        index: globalChunkIndex++,
        metadata: {
          page: documentMetadata.page,
          section: section.heading || undefined,
          heading: section.heading || undefined,
          tokens: chunkTokens.length,
        },
      });

      // Break nếu đã hết tokens
      if (i + chunkSize >= tokens.length) {
        break;
      }
    }
  }

  return chunks;
}

/**
 * Chunk multiple pages (for PDF processing)
 */
export function chunkPages(
  pages: Array<{ pageNumber: number; text: string }>,
  options: ChunkingOptions = {}
): DocumentChunk[] {
  const allChunks: DocumentChunk[] = [];
  let globalIndex = 0;

  for (const page of pages) {
    const pageChunks = chunkDocument(
      page.text,
      { page: page.pageNumber },
      options
    );

    // Update global index
    for (const chunk of pageChunks) {
      allChunks.push({
        ...chunk,
        index: globalIndex++,
      });
    }
  }

  return allChunks;
}

/**
 * Validate chunk quality
 * Check nếu chunk quá ngắn hoặc quá dài
 */
export function validateChunk(chunk: DocumentChunk): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const tokens = chunk.metadata.tokens || estimateTokens(chunk.content);

  if (tokens < 50) {
    warnings.push('Chunk quá ngắn (< 50 tokens)');
  }

  if (tokens > 1024) {
    warnings.push('Chunk quá dài (> 1024 tokens)');
  }

  if (chunk.content.trim().length < 20) {
    warnings.push('Chunk content quá ngắn');
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * Get chunking statistics
 */
export function getChunkingStats(chunks: DocumentChunk[]): {
  totalChunks: number;
  averageTokens: number;
  minTokens: number;
  maxTokens: number;
  totalTokens: number;
} {
  if (chunks.length === 0) {
    return {
      totalChunks: 0,
      averageTokens: 0,
      minTokens: 0,
      maxTokens: 0,
      totalTokens: 0,
    };
  }

  const tokenCounts = chunks.map(c => c.metadata.tokens || estimateTokens(c.content));
  const totalTokens = tokenCounts.reduce((sum, t) => sum + t, 0);

  return {
    totalChunks: chunks.length,
    averageTokens: Math.round(totalTokens / chunks.length),
    minTokens: Math.min(...tokenCounts),
    maxTokens: Math.max(...tokenCounts),
    totalTokens,
  };
}
