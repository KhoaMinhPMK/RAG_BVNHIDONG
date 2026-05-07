/**
 * Multi-Query Generator
 *
 * Generates N rephrased variants of a query, retrieves results for each
 * independently, then merges via Reciprocal Rank Fusion.
 *
 * This improves recall when a single phrasing misses relevant chunks.
 */

import { llmChat } from '../llm/unified.js';
import { logger } from '../utils/logger.js';

const MULTI_QUERY_SYSTEM = `Bạn là chuyên gia y tế Nhi khoa.
Nhiệm vụ: Tạo các câu truy vấn thay thế để tìm kiếm tài liệu y khoa.

Quy tắc:
- Tạo đúng {N} câu truy vấn khác nhau về cách diễn đạt nhưng cùng ý nghĩa
- Mỗi câu trên một dòng riêng, không đánh số, không ký tự đặc biệt
- Đa dạng: dùng từ đồng nghĩa, góc nhìn khác, mức độ chi tiết khác
- Trả về CHỈ các câu truy vấn, không giải thích`;

/**
 * Generate N query variants for a given query.
 * Returns the original query if LLM call fails.
 */
export async function generateMultiQuery(query: string, n: number = 3): Promise<string[]> {
  try {
    const result = await llmChat(
      [
        {
          role: 'system',
          content: MULTI_QUERY_SYSTEM.replace('{N}', String(n)),
        },
        {
          role: 'user',
          content: `Câu hỏi gốc: "${query}"\n\nCác câu truy vấn thay thế:`,
        },
      ],
      { temperature: 0.7, max_tokens: 200 },
      'ollama'
    );

    const lines = result.content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 5 && l !== query)
      .slice(0, n);

    if (lines.length > 0) {
      logger.debug('[MultiQuery] generated variants', { query, variants: lines });
      return [query, ...lines];
    }
  } catch (err) {
    logger.warn('[MultiQuery] generation failed, using original only', { error: err });
  }

  return [query];
}

/**
 * Merge multiple ranked result lists via Reciprocal Rank Fusion.
 * Each item is identified by its document_id.
 * Returns items sorted by fused RRF score descending.
 */
export function rrfMerge<T extends { document_id: string }>(
  rankedLists: T[][],
  k: number = 60
): T[] {
  const scoreMap = new Map<string, { item: T; score: number }>();

  for (const list of rankedLists) {
    list.forEach((item, rankIdx) => {
      const existing = scoreMap.get(item.document_id);
      const increment = 1 / (k + rankIdx + 1);
      if (existing) {
        existing.score += increment;
      } else {
        scoreMap.set(item.document_id, { item, score: increment });
      }
    });
  }

  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}
