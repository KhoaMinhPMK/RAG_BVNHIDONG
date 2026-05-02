import { logger } from '../utils/logger.js';

interface OllamaGenerateRequest {
  model: string;
  prompt?: string;
  system?: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
  };
}

interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  eval_duration?: number;
}

export class OllamaClient {
  private baseUrl: string;
  private model: string;
  private maxRetries: number;
  private timeout: number;

  constructor(
    baseUrl?: string,
    model?: string
  ) {
    // Read env vars inside constructor, not in default parameters
    this.baseUrl = baseUrl || process.env.OLLAMA_URL || 'http://localhost:11434';
    this.model = model || process.env.OLLAMA_MODEL || 'qwen2.5:7b';
    this.maxRetries = 3;
    this.timeout = 60000; // 60 seconds
  }

  /**
   * Generate text completion with retry logic
   * Supports both simple prompt and system+prompt format
   */
  async generate(
    request: string | OllamaGenerateRequest,
    options?: OllamaGenerateRequest['options']
  ): Promise<OllamaGenerateResponse> {
    let lastError: Error | null = null;

    // Normalize request
    const req: OllamaGenerateRequest = typeof request === 'string'
      ? { model: this.model, prompt: request }
      : request;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        logger.info(`Ollama generate attempt ${attempt}/${this.maxRetries}`, {
          model: req.model || this.model,
          promptLength: req.prompt?.length || 0,
          hasSystem: !!req.system,
        });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(`${this.baseUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: req.model || this.model,
            prompt: req.prompt,
            system: req.system,
            stream: req.stream ?? false,
            options: {
              temperature: 0.7,
              top_p: 0.9,
              num_predict: 2048,
              ...options,
            },
          } as OllamaGenerateRequest),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
        }

        const data: OllamaGenerateResponse = await response.json();

        logger.info('Ollama generate success', {
          model: data.model,
          responseLength: data.response.length,
          evalCount: data.eval_count,
          duration: data.total_duration ? `${(data.total_duration / 1e9).toFixed(2)}s` : 'N/A',
        });

        return data;
      } catch (error) {
        lastError = error as Error;

        if (error instanceof Error && error.name === 'AbortError') {
          logger.warn(`Ollama request timeout (attempt ${attempt}/${this.maxRetries})`);
        } else {
          logger.warn(`Ollama request failed (attempt ${attempt}/${this.maxRetries})`, {
            error: (error as Error).message,
          });
        }

        // Wait before retry (exponential backoff)
        if (attempt < this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `Ollama request failed after ${this.maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Test connection to Ollama server
   */
  async testConnection(): Promise<boolean> {
    try {
      logger.info('Testing Ollama connection', { baseUrl: this.baseUrl });

      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        logger.error('Ollama connection test failed', {
          baseUrl: this.baseUrl,
          status: response.status,
          statusText: response.statusText,
        });
        return false;
      }

      const data = await response.json();
      const availableModels = data.models?.map((m: any) => m.name) || [];
      const modelExists = availableModels.some((name: string) =>
        name === this.model || name === `${this.model}:latest`
      );

      if (!modelExists) {
        logger.warn(`Model ${this.model} not found in Ollama`, {
          requestedModel: this.model,
          availableModels: availableModels,
        });
        // Don't fail - just warn. Server can still start.
        return true;
      }

      logger.info('✅ Ollama connection successful', {
        baseUrl: this.baseUrl,
        model: this.model,
      });

      return true;
    } catch (error) {
      logger.error('Ollama connection test error', {
        baseUrl: this.baseUrl,
        error: (error as Error).message,
        stack: (error as Error).stack,
        errorType: (error as Error).name,
      });
      return false;
    }
  }

  /**
   * Generate with structured prompt template
   */
  async generateWithTemplate(
    systemPrompt: string,
    userPrompt: string,
    options?: OllamaGenerateRequest['options']
  ): Promise<string> {
    const result = await this.generate({
      model: this.model,
      system: systemPrompt,
      prompt: userPrompt,
    }, options);

    return result.response;
  }
}

// Lazy singleton instance - initialized on first access to ensure env vars are loaded
let _ollamaClient: OllamaClient | null = null;

export const ollamaClient = new Proxy({} as OllamaClient, {
  get(target, prop) {
    if (!_ollamaClient) {
      _ollamaClient = new OllamaClient();
    }
    const value = (_ollamaClient as any)[prop];
    return typeof value === 'function' ? value.bind(_ollamaClient) : value;
  }
});

export function getOllamaClient(): OllamaClient {
  if (!_ollamaClient) {
    _ollamaClient = new OllamaClient();
  }
  return _ollamaClient;
}

// Test connection on module load
ollamaClient.testConnection().catch((err) => {
  logger.error('Failed to connect to Ollama on startup', { error: err.message });
});
