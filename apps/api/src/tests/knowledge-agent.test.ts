import { describe, expect, it } from 'vitest';

import { extractFallbackSearchTerms } from '../agents/knowledge.js';

describe('extractFallbackSearchTerms', () => {
  it('preserves Vietnamese terms with diacritics for fallback retrieval', () => {
    const terms = extractFallbackSearchTerms(
      'Hướng dẫn điều trị viêm phổi cộng đồng ở trẻ em?',
      new Set(['the', 'and'])
    );

    expect(terms).toEqual(
      expect.arrayContaining(['hướng', 'huong', 'điều', 'dieu', 'viêm', 'viem', 'phổi', 'phoi'])
    );
    expect(terms.some((term) => term === 'vi' || term === 'm')).toBe(false);
  });

  it('deduplicates normalized terms and removes configured stop words', () => {
    const terms = extractFallbackSearchTerms(
      'Guideline guideline pneumonia treatment and treatment',
      new Set(['and'])
    );

    expect(terms).toEqual(['guideline', 'pneumonia', 'treatment']);
  });
});