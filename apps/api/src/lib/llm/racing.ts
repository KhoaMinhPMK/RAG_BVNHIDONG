/**
 * Multi-LLM Racing Strategy
 * Call both Ollama and MiMo in parallel, first response wins
 * Store both for comparison and quality monitoring
 */

import { getMiMoClient } from '../mimo/client.js';
import { getOllamaClient } from '../ollama/client.js';

interface RacingResult {
  winner: 'ollama' | 'mimo';
  response: string;
  ollamaResponse?: string;
  mimoResponse?: string;
  ollamaTime?: number;
  mimoTime?: number;
  error?: string;
}

interface RacingOptions {
  timeout?: number; // ms
  preferOllama?: boolean; // Prefer Ollama for privacy
  storeComparison?: boolean; // Store both responses for quality comparison
}

export class LLMRacer {
  private mimoClient = getMiMoClient();
  private ollamaClient = getOllamaClient();

  /**
   * Race between Ollama and MiMo
   * First response wins, but both are stored for comparison
   */
  async race(
    query: string,
    context: string,
    options: RacingOptions = {}
  ): Promise<RacingResult> {
    const {
      timeout = 30000,
      preferOllama = false,
      storeComparison = true,
    } = options;

    const startTime = Date.now();

    // Prepare prompts
    const systemPrompt = `You are a medical AI assistant. Use the following context to answer the question accurately and concisely.

Context:
${context}`;

    const userPrompt = query;

    // Race both APIs
    const results = await Promise.allSettled([
      this.callOllama(systemPrompt, userPrompt, timeout),
      this.callMiMo(systemPrompt, userPrompt, timeout),
    ]);

    const ollamaResult = results[0];
    const mimoResult = results[1];

    // Extract responses and times
    let ollamaResponse: string | undefined;
    let ollamaTime: number | undefined;
    let mimoResponse: string | undefined;
    let mimoTime: number | undefined;

    if (ollamaResult.status === 'fulfilled') {
      ollamaResponse = ollamaResult.value.response;
      ollamaTime = ollamaResult.value.time;
    }

    if (mimoResult.status === 'fulfilled') {
      mimoResponse = mimoResult.value.response;
      mimoTime = mimoResult.value.time;
    }

    // Determine winner
    let winner: 'ollama' | 'mimo';
    let response: string;

    if (preferOllama && ollamaResponse) {
      // Privacy mode: prefer Ollama if available
      winner = 'ollama';
      response = ollamaResponse;
    } else if (ollamaTime && mimoTime) {
      // Both succeeded: fastest wins
      winner = ollamaTime < mimoTime ? 'ollama' : 'mimo';
      response = winner === 'ollama' ? ollamaResponse! : mimoResponse!;
    } else if (ollamaResponse) {
      // Only Ollama succeeded
      winner = 'ollama';
      response = ollamaResponse;
    } else if (mimoResponse) {
      // Only MiMo succeeded
      winner = 'mimo';
      response = mimoResponse;
    } else {
      // Both failed
      const error = this.extractError(ollamaResult, mimoResult);
      throw new Error(`Both LLMs failed: ${error}`);
    }

    const result: RacingResult = {
      winner,
      response,
    };

    // Store comparison data if requested
    if (storeComparison) {
      result.ollamaResponse = ollamaResponse;
      result.mimoResponse = mimoResponse;
      result.ollamaTime = ollamaTime;
      result.mimoTime = mimoTime;

      // Log for monitoring
      console.log('[LLMRacer] Race completed:', {
        winner,
        ollamaTime,
        mimoTime,
        ollamaSuccess: !!ollamaResponse,
        mimoSuccess: !!mimoResponse,
      });
    }

    return result;
  }

  /**
   * Call Ollama with timeout
   */
  private async callOllama(
    systemPrompt: string,
    userPrompt: string,
    timeout: number
  ): Promise<{ response: string; time: number }> {
    const startTime = Date.now();
    const { promise: timeoutP, clear } = this.timeoutPromise(timeout, 'Ollama timeout');

    try {
      const response = await Promise.race([
        this.ollamaClient.generate({
          model: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
          system: systemPrompt,
          prompt: userPrompt,
          stream: false,
        }),
        timeoutP,
      ]);

      return {
        response: response.response,
        time: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[LLMRacer] Ollama error:', error);
      throw error;
    } finally {
      clear();
    }
  }

  /**
   * Call MiMo with timeout
   */
  private async callMiMo(
    systemPrompt: string,
    userPrompt: string,
    timeout: number
  ): Promise<{ response: string; time: number }> {
    const startTime = Date.now();
    const { promise: timeoutP, clear } = this.timeoutPromise(timeout, 'MiMo timeout');

    try {
      const response = await Promise.race([
        this.mimoClient.chat([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ]),
        timeoutP,
      ]);

      return {
        response: response.choices[0]?.message?.content || '',
        time: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[LLMRacer] MiMo error:', error);
      throw error;
    } finally {
      clear();
    }
  }

  /**
   * Timeout promise helper — clears the timer when the returned promise
   * is raced against a succeeding promise so the handle does not leak.
   */
  private timeoutPromise(ms: number, message: string): { promise: Promise<never>; clear: () => void } {
    let timer: ReturnType<typeof setTimeout>;
    const promise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    });
    const clear = () => clearTimeout(timer!);
    return { promise, clear };
  }

  /**
   * Extract error message from failed results
   */
  private extractError(
    ollamaResult: PromiseSettledResult<any>,
    mimoResult: PromiseSettledResult<any>
  ): string {
    const errors: string[] = [];

    if (ollamaResult.status === 'rejected') {
      errors.push(`Ollama: ${ollamaResult.reason?.message || 'Unknown error'}`);
    }

    if (mimoResult.status === 'rejected') {
      errors.push(`MiMo: ${mimoResult.reason?.message || 'Unknown error'}`);
    }

    return errors.join('; ');
  }
}

// Singleton instance
let llmRacer: LLMRacer | null = null;

export function getLLMRacer(): LLMRacer {
  if (!llmRacer) {
    llmRacer = new LLMRacer();
  }
  return llmRacer;
}
