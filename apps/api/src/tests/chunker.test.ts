import { describe, expect, it } from 'vitest';

import { createChunker } from '../lib/ingestion/chunker.js';
import { tokenizer } from '../lib/utils/tokenizer.js';

function buildParagraph(word: string, maxTokens: number): string {
  let paragraph = word;

  while (true) {
    const nextParagraph = `${paragraph} ${word}`;
    const nextTokenCount = tokenizer.countTokens(nextParagraph);

    if (nextTokenCount > maxTokens) {
      return paragraph;
    }

    paragraph = nextParagraph;
  }
}

describe('Chunker', () => {
  it('keeps overlapped paragraph chunks within the configured token limit', () => {
    const maxTokens = 120;
    const overlapTokens = 30;
    const paragraphTokens = 55;
    const chunker = createChunker({
      max_tokens: maxTokens,
      overlap_tokens: overlapTokens,
      preserve_paragraphs: true,
      preserve_sentences: true,
    });

    const paragraphs = [
      buildParagraph('alpha', paragraphTokens),
      buildParagraph('bravo', paragraphTokens),
      buildParagraph('charlie', paragraphTokens),
      buildParagraph('delta', paragraphTokens),
    ];

    const chunks = chunker.chunkDocument(
      {
        content: paragraphs.join('\n\n'),
        metadata: {
          title: 'chunk overlap',
          version: 'v1',
          effective_date: '2026-01-01',
          source: 'test',
          document_type: 'reference',
        },
      },
      'doc-1'
    );

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.metadata.token_count <= maxTokens)).toBe(true);
    expect(chunks[1]?.content).toContain('alpha');
    expect(chunks[1]?.content).toContain('bravo');
  });
});