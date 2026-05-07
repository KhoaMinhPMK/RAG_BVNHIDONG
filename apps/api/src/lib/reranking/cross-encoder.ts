/**
 * Cross-Encoder Reranker
 *
 * Uses an LLM as a cross-encoder to score (query, chunk) pairs.
 * Runs on top-N candidates from the retrieval stage and returns
 * the highest-scoring ones.
 *
 * Design:
 * - Batches scoring prompts to reduce LLM round trips
 * - Scores 1-5; threshold configurable
 * - Falls back to original ranking order if LLM unavailable
 */

import { llmChat } from '../llm/unified.js';
import { logger } from '../utils/logger.js';
import type { KnowledgeDocument } from '../../agents/knowledge-ranking.js';

export interface RerankResult {
  document: KnowledgeDocument;
  rerank_score: number;
}

const RERANK_SYSTEM = `Bạn là chuyên gia đánh giá tài liệu y tế Nhi khoa.
Nhiệm vụ: Đánh giá mức độ liên quan của đoạn văn tài liệu đối với câu hỏi lâm sàng.

Thang điểm:
5 - Đoạn văn trả lời trực tiếp câu hỏi, thông tin đầy đủ và cụ thể
4 - Đoạn văn liên quan cao, có thông tin hữu ích dù chưa đầy đủ
3 - Đoạn văn liên quan một phần
2 - Đoạn văn ít liên quan
1 - Đoạn văn không liên quan

Trả về CHỈ một số nguyên từ 1 đến 5, không giải thích.`;

/**
 * Score a single (query, document) pair.
 * Returns a score from 1–5, or 0 on failure.
 */
async function scoreChunk(query: string, chunk: KnowledgeDocument): Promise<number> {
  const excerpt = chunk.content.slice(0, 600);
  try {
    const result = await llmChat(
      [
        { role: 'system', content: RERANK_SYSTEM },
        {
          role: 'user',
          content:
            `Câu hỏi: "${query}"\n\n` +
            `Tài liệu: ${chunk.title}\n` +
            `Đoạn văn:\n${excerpt}\n\n` +
            `Điểm liên quan (1-5):`,
        },
      ],
      { temperature: 0.0, max_tokens: 5 },
      'ollama'
    );

    const score = parseInt(result.content.trim(), 10);
    return Number.isNaN(score) ? 0 : Math.min(5, Math.max(1, score));
  } catch {
    return 0;
  }
}

/**
 * Rerank a list of candidate documents using LLM cross-encoder scoring.
 * Scores in parallel (with concurrency cap) then sorts descending.
 *
 * @param query        The original user query
 * @param candidates   Top-K candidates from retrieval stage
 * @param topN         Number of results to return after reranking
 * @param concurrency  Max parallel LLM calls (default 4)
 * @param minScore     Drop chunks scoring below this threshold (default 2)
 */
export async function rerankDocuments(
  query: string,
  candidates: KnowledgeDocument[],
  topN: number = 5,
  concurrency: number = 4,
  minScore: number = 2
): Promise<KnowledgeDocument[]> {
  if (candidates.length === 0) return [];

  // Only rerank if we have more candidates than we need
  if (candidates.length <= topN) return candidates;

  const t0 = Date.now();

  // Score in batches to control concurrency
  const results: RerankResult[] = [];

  for (let i = 0; i < candidates.length; i += concurrency) {
    const batch = candidates.slice(i, i + concurrency);
    const scores = await Promise.all(batch.map((doc) => scoreChunk(query, doc)));

    for (let j = 0; j < batch.length; j++) {
      results.push({ document: batch[j], rerank_score: scores[j] });
    }
  }

  const ranked = results
    .filter((r) => r.rerank_score >= minScore)
    .sort((a, b) => b.rerank_score - a.rerank_score)
    .slice(0, topN)
    .map((r) => r.document);

  logger.info('[Reranker] cross-encoder reranking done', {
    candidates: candidates.length,
    surviving: ranked.length,
    topN,
    latencyMs: Date.now() - t0,
  });

  // If reranker filtered everything out, fall back to original top-N
  if (ranked.length === 0) {
    logger.warn('[Reranker] all candidates filtered, using original ranking');
    return candidates.slice(0, topN);
  }

  return ranked;
}
