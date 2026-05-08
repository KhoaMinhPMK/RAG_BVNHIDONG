/**
 * Session Auto-Title Generator
 *
 * Generates a short Vietnamese title (5-7 words) from the first user message,
 * using the local LLM to keep latency low.
 */

import { llmChat } from '../llm/unified.js';
import { logger } from '../utils/logger.js';

export async function generateSessionTitle(firstUserMessage: string): Promise<string> {
  // Truncate input for the prompt
  const trimmed = firstUserMessage.slice(0, 300);

  try {
    const result = await llmChat(
      [
        {
          role: 'system',
          content:
            'Tạo tiêu đề ngắn (5-7 từ tiếng Việt) tóm tắt câu hỏi sau. Chỉ trả lời tiêu đề, không giải thích, không dấu chấm cuối.',
        },
        { role: 'user', content: trimmed },
      ],
      { max_tokens: 32, temperature: 0.3 },
      'ollama'
    );

    const title = result.content.trim().replace(/[.!?]+$/, '').slice(0, 80);
    return title || 'Phiên tư vấn';
  } catch (err) {
    logger.warn('[AutoTitle] Failed to generate title', { error: err });
    // Fallback: extract first few words of user message
    const words = firstUserMessage.trim().split(/\s+/).slice(0, 6).join(' ');
    return words.slice(0, 60) || 'Phiên tư vấn';
  }
}
