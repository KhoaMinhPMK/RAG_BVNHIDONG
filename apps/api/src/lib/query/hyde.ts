/**
 * HyDE — Hypothetical Document Embeddings
 *
 * Instead of embedding the raw query, we ask an LLM to write a short
 * "hypothetical answer" paragraph, then embed THAT text.  Medical knowledge
 * documents use different vocabulary from user questions, so embedding a
 * plausible answer phrase closes the semantic gap.
 *
 * Reference: Gao et al. "Precise Zero-Shot Dense Retrieval without Relevance
 * Labels" (2022).
 */

import { llmChat } from '../llm/unified.js';
import { logger } from '../utils/logger.js';

const HYDE_SYSTEM = `Bạn là bác sĩ Nhi khoa viết tóm tắt lâm sàng ngắn cho tài liệu y tế nội bộ.
Nhiệm vụ: Viết một đoạn văn (~80 từ) như thể đó là trích đoạn từ tài liệu y khoa trả lời câu hỏi.
Đoạn văn phải dùng ngôn ngữ y khoa chuyên nghiệp, không dùng đại từ nhân xưng.
Trả về CHỈ đoạn văn, không giải thích, không tiêu đề.`;

/**
 * Generate a hypothetical document passage for the query.
 * Returns null if generation fails so callers can fall back gracefully.
 */
export async function generateHypotheticalDocument(query: string): Promise<string | null> {
  try {
    const result = await llmChat(
      [
        { role: 'system', content: HYDE_SYSTEM },
        {
          role: 'user',
          content: `Câu hỏi lâm sàng: "${query}"\n\nĐoạn văn tài liệu y khoa:`,
        },
      ],
      { temperature: 0.4, max_tokens: 200 },
      'ollama'
    );

    const passage = result.content.trim();
    if (passage.length > 20) {
      logger.debug('[HyDE] generated passage', { query, length: passage.length });
      return passage;
    }
  } catch (err) {
    logger.warn('[HyDE] generation failed', { error: err });
  }

  return null;
}
