/**
 * Unified LLM Service
 *
 * Single interface to call either Ollama (local) or MiMo (cloud API).
 * Routes are:
 *   provider = 'ollama'  → apps/api/src/lib/ollama/client.ts
 *   provider = 'mimo'    → apps/api/src/lib/mimo/client.ts
 */

import { logger } from '../utils/logger.js';

export type LLMProvider = 'ollama' | 'mimo';

export interface UnifiedChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface UnifiedChatOptions {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

export interface UnifiedChatResult {
  content: string;
  provider: LLMProvider;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  latency_ms: number;
}

// ─── Ollama adapter ───────────────────────────────────────────────────────────

async function callOllama(
  messages: UnifiedChatMessage[],
  opts: UnifiedChatOptions
): Promise<UnifiedChatResult> {
  const t0 = Date.now();
  const { ollamaClient } = await import('../ollama/client.js');

  // Ollama expects separate system + prompt strings
  const systemMsg = messages.find((m) => m.role === 'system')?.content ?? '';
  const userMsgs = messages
    .filter((m) => m.role !== 'system')
    .map((m) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
    .join('\n');

  const result = await ollamaClient.generateWithTemplate(systemMsg, userMsgs, {
    temperature: opts.temperature ?? 0.3,
    num_predict: opts.max_tokens ?? 1024,
  });

  return {
    content: result.trim(),
    provider: 'ollama',
    model: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
    latency_ms: Date.now() - t0,
  };
}

// ─── MiMo adapter ─────────────────────────────────────────────────────────────

async function callMimo(
  messages: UnifiedChatMessage[],
  opts: UnifiedChatOptions
): Promise<UnifiedChatResult> {
  const t0 = Date.now();
  const { getMiMoClient } = await import('../mimo/client.js');
  const client = getMiMoClient();

  const result = await client.chat(messages, {
    temperature: opts.temperature ?? 1.0,
    max_tokens: opts.max_tokens ?? 2048,
    top_p: opts.top_p ?? 0.95,
  });

  const content = result.choices[0]?.message?.content ?? '';

  return {
    content: content.trim(),
    provider: 'mimo',
    model: result.model || (process.env.MIMO_MODEL_PRIMARY || 'mimo-v2.5-pro'),
    usage: result.usage,
    latency_ms: Date.now() - t0,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function llmChat(
  messages: UnifiedChatMessage[],
  opts: UnifiedChatOptions = {},
  provider: LLMProvider = 'ollama'
): Promise<UnifiedChatResult> {
  logger.info('[UnifiedLLM] chat', { provider, messages: messages.length });

  try {
    if (provider === 'mimo') {
      return await callMimo(messages, opts);
    }
    return await callOllama(messages, opts);
  } catch (err) {
    logger.error(`[UnifiedLLM] ${provider} failed`, { error: err });
    throw err;
  }
}

/**
 * Test connectivity for a given provider.
 * Returns { ok, model, latency_ms } or { ok: false, error }
 */
export async function testLLMProvider(
  provider: LLMProvider
): Promise<{ ok: boolean; model: string; latency_ms?: number; error?: string }> {
  const t0 = Date.now();
  try {
    if (provider === 'mimo') {
      const { getMiMoClient } = await import('../mimo/client.js');
      const client = getMiMoClient();
      const result = await client.chat(
        [{ role: 'user', content: 'ping' }],
        { max_tokens: 8, temperature: 0.1 }
      );
      const model = result.model || (process.env.MIMO_MODEL_PRIMARY || 'mimo-v2.5-pro');
      return { ok: true, model, latency_ms: Date.now() - t0 };
    } else {
      const { ollamaClient } = await import('../ollama/client.js');
      const connected = await ollamaClient.testConnection();
      return {
        ok: connected,
        model: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
        latency_ms: Date.now() - t0,
        error: connected ? undefined : 'Ollama not reachable',
      };
    }
  } catch (err) {
    return {
      ok: false,
      model: '',
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
