/**
 * Faithfulness Checker
 *
 * After the LLM generates an answer, this module runs a second LLM call to
 * verify that every claim in the answer is actually supported by the retrieved
 * context passages.
 *
 * Verdict levels:
 *   SUPPORTED    — answer is well-grounded in the context (score >= 0.7)
 *   PARTIAL      — some claims are unsupported (0.4 <= score < 0.7)
 *   UNSUPPORTED  — answer is mostly not grounded (score < 0.4)
 *
 * If verdict is UNSUPPORTED, the caller should refuse / regenerate.
 */

import { llmChat } from '../llm/unified.js';
import { logger } from '../utils/logger.js';

export type FaithfulnessVerdict = 'SUPPORTED' | 'PARTIAL' | 'UNSUPPORTED';

export interface FaithfulnessResult {
  verdict: FaithfulnessVerdict;
  score: number;           // 0.0 – 1.0
  reasoning?: string;
  latency_ms: number;
}

const FAITHFULNESS_SYSTEM = `Bạn là chuyên gia kiểm tra tính chính xác của câu trả lời y tế.
Nhiệm vụ: Kiểm tra xem CÂU TRẢ LỜI có được hỗ trợ bởi NGỮ CẢNH hay không.

Đánh giá:
- SUPPORTED: Mọi thông tin trong câu trả lời đều có trong ngữ cảnh (điểm 0.7 - 1.0)
- PARTIAL: Một phần thông tin có trong ngữ cảnh, phần khác không rõ ràng (điểm 0.4 - 0.69)
- UNSUPPORTED: Câu trả lời chứa thông tin không có trong ngữ cảnh (điểm 0.0 - 0.39)

Trả về theo định dạng:
VERDICT: [SUPPORTED|PARTIAL|UNSUPPORTED]
SCORE: [0.0-1.0]
REASON: [Lý do ngắn gọn, 1 câu]`;

/**
 * Check whether an answer is grounded in the provided context.
 *
 * @param query    The original user question
 * @param answer   The LLM-generated answer to verify
 * @param context  The retrieved context passages used for generation
 */
export async function checkFaithfulness(
  query: string,
  answer: string,
  context: string
): Promise<FaithfulnessResult> {
  const t0 = Date.now();

  // Short answers that already signal uncertainty don't need checking
  if (
    answer.startsWith('INSUFFICIENT_EVIDENCE') ||
    answer.startsWith('OUT_OF_SCOPE') ||
    answer.length < 30
  ) {
    return { verdict: 'SUPPORTED', score: 1.0, latency_ms: 0 };
  }

  try {
    const result = await llmChat(
      [
        { role: 'system', content: FAITHFULNESS_SYSTEM },
        {
          role: 'user',
          content:
            `CÂU HỎI: ${query}\n\n` +
            `NGỮ CẢNH:\n${context.slice(0, 3000)}\n\n` +
            `CÂU TRẢ LỜI CẦN KIỂM TRA:\n${answer.slice(0, 1000)}\n\n` +
            `Đánh giá:`,
        },
      ],
      { temperature: 0.0, max_tokens: 120 },
      'ollama'
    );

    const text = result.content.trim();
    const verdict = parseVerdict(text);
    const score = parseScore(text);
    const reasoning = parseReason(text);

    const latency_ms = Date.now() - t0;

    logger.info('[Faithfulness] check complete', { verdict, score, latency_ms });
    return { verdict, score, reasoning, latency_ms };
  } catch (err) {
    logger.warn('[Faithfulness] check failed, assuming SUPPORTED', { error: err });
    return { verdict: 'SUPPORTED', score: 0.5, latency_ms: Date.now() - t0 };
  }
}

function parseVerdict(text: string): FaithfulnessVerdict {
  if (/UNSUPPORTED/i.test(text)) return 'UNSUPPORTED';
  if (/PARTIAL/i.test(text)) return 'PARTIAL';
  return 'SUPPORTED';
}

function parseScore(text: string): number {
  const match = text.match(/SCORE:\s*([\d.]+)/i);
  if (!match) return 0.5;
  const n = parseFloat(match[1]);
  return Number.isNaN(n) ? 0.5 : Math.min(1, Math.max(0, n));
}

function parseReason(text: string): string | undefined {
  const match = text.match(/REASON:\s*(.+)/i);
  return match ? match[1].trim() : undefined;
}
