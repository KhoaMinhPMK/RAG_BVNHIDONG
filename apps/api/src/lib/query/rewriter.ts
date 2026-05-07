/**
 * Query Rewriter
 *
 * Rewrites an ambiguous or short user query into a clearer, more specific
 * form before embedding.  Uses a small, fast LLM call (low temp).
 *
 * Example:
 *   Input : "viêm phổi trẻ"
 *   Output: "Phác đồ điều trị viêm phổi ở trẻ em dưới 5 tuổi theo hướng dẫn WHO"
 *
 * Also exports translateToEnglish() for BM25 cross-lingual search:
 *   Input : "Điều trị viêm phổi ở trẻ"
 *   Output: "pneumonia treatment children"
 */

import { llmChat } from '../llm/unified.js';
import { logger } from '../utils/logger.js';

const REWRITE_SYSTEM = `Bạn là chuyên gia y tế Nhi khoa.
Nhiệm vụ: Viết lại câu hỏi của người dùng thành câu truy vấn tài liệu y khoa rõ ràng hơn.

Quy tắc:
- Giữ nguyên ý nghĩa gốc
- Thêm từ khóa y khoa liên quan nếu thiếu
- Trả về CHỈ câu truy vấn đã được viết lại, không giải thích thêm
- Tối đa 1 câu, dưới 80 từ`;

const TRANSLATE_SYSTEM = `You are a medical translator. Translate the Vietnamese medical query to English keywords suitable for a full-text search index.

Rules:
- Output only English keywords/phrase, no Vietnamese
- Use standard medical terminology (ICD-10, MeSH preferred)
- Maximum 12 words
- No explanations, no punctuation except spaces`;

export async function rewriteQuery(query: string): Promise<string> {
  // Skip rewrite for already long/specific queries
  if (query.trim().split(/\s+/).length >= 12) {
    return query;
  }

  try {
    const result = await llmChat(
      [
        { role: 'system', content: REWRITE_SYSTEM },
        { role: 'user', content: `Câu hỏi gốc: "${query}"\n\nCâu truy vấn được viết lại:` },
      ],
      { temperature: 0.1, max_tokens: 120 },
      'ollama'
    );

    const rewritten = result.content.trim().replace(/^["']|["']$/g, '');

    if (rewritten && rewritten.length > 0 && rewritten !== query) {
      logger.debug('[QueryRewriter] rewritten', { original: query, rewritten });
      return rewritten;
    }
  } catch (err) {
    logger.warn('[QueryRewriter] rewrite failed, using original', { error: err });
  }

  return query;
}

/**
 * Translate a Vietnamese query to English keywords for BM25 lexical search
 * against English-language medical documents.
 * Falls back to original query on error (vector search still works).
 */
export async function translateToEnglish(query: string): Promise<string> {
  // If already predominantly ASCII/English, return as-is
  const vietnameseRatio = (query.match(/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/gi) || []).length / query.length;
  if (vietnameseRatio < 0.05) {
    return query; // Already English-like
  }

  try {
    const result = await llmChat(
      [
        { role: 'system', content: TRANSLATE_SYSTEM },
        { role: 'user', content: query },
      ],
      { temperature: 0.0, max_tokens: 60 },
      'ollama'
    );

    const translated = result.content.trim().replace(/^["']|["']$/g, '');
    if (translated && translated.length > 0) {
      logger.debug('[QueryRewriter] translated to English', { original: query, translated });
      return translated;
    }
  } catch (err) {
    logger.warn('[QueryRewriter] translation failed, using original for BM25', { error: err });
  }

  return query;
}
