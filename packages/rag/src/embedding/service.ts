/**
 * Embedding service - wrapper cho Ollama nomic-embed-text
 * Batch support, retry logic, timeout handling
 */

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const EMBEDDING_MODEL = 'nomic-embed-text';
const DEFAULT_TIMEOUT = 30000; // 30s
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1s

export interface EmbeddingOptions {
  timeout?: number;
  retries?: number;
}

export interface EmbeddingResult {
  embedding: number[];
  dimensions: number;
  latency: number;
}

export interface BatchEmbeddingResult {
  embeddings: number[][];
  dimensions: number;
  totalLatency: number;
  averageLatency: number;
}

/**
 * Embed single text
 */
export async function embedText(
  text: string,
  options: EmbeddingOptions = {}
): Promise<EmbeddingResult> {
  const { timeout = DEFAULT_TIMEOUT, retries = MAX_RETRIES } = options;
  const startTime = Date.now();

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          prompt: text,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.embedding || !Array.isArray(data.embedding)) {
        throw new Error('Invalid embedding response from Ollama');
      }

      const latency = Date.now() - startTime;

      return {
        embedding: data.embedding,
        dimensions: data.embedding.length,
        latency,
      };
    } catch (error) {
      lastError = error as Error;

      // Không retry nếu là lỗi validation
      if (error instanceof Error && error.message.includes('Invalid')) {
        throw error;
      }

      // Retry với exponential backoff
      if (attempt < retries) {
        const delay = RETRY_DELAY * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  throw new Error(`Failed to embed text after ${retries} retries: ${lastError?.message}`);
}

/**
 * Embed batch of texts (parallel)
 * Theo benchmark: ~167ms/text average, 6 texts/sec throughput
 */
export async function embedBatch(
  texts: string[],
  options: EmbeddingOptions = {}
): Promise<BatchEmbeddingResult> {
  if (texts.length === 0) {
    return {
      embeddings: [],
      dimensions: 0,
      totalLatency: 0,
      averageLatency: 0,
    };
  }

  const startTime = Date.now();

  // Embed parallel với Promise.all
  const results = await Promise.all(
    texts.map(text => embedText(text, options))
  );

  const totalLatency = Date.now() - startTime;

  return {
    embeddings: results.map(r => r.embedding),
    dimensions: results[0]?.dimensions || 0,
    totalLatency,
    averageLatency: Math.round(totalLatency / texts.length),
  };
}

/**
 * Embed batch với chunking (để tránh overload)
 * Useful khi embed nhiều documents cùng lúc
 */
export async function embedBatchChunked(
  texts: string[],
  chunkSize: number = 10,
  options: EmbeddingOptions = {}
): Promise<BatchEmbeddingResult> {
  if (texts.length === 0) {
    return {
      embeddings: [],
      dimensions: 0,
      totalLatency: 0,
      averageLatency: 0,
    };
  }

  const startTime = Date.now();
  const allEmbeddings: number[][] = [];
  let dimensions = 0;

  // Process in chunks
  for (let i = 0; i < texts.length; i += chunkSize) {
    const chunk = texts.slice(i, i + chunkSize);
    const result = await embedBatch(chunk, options);
    allEmbeddings.push(...result.embeddings);
    dimensions = result.dimensions;
  }

  const totalLatency = Date.now() - startTime;

  return {
    embeddings: allEmbeddings,
    dimensions,
    totalLatency,
    averageLatency: Math.round(totalLatency / texts.length),
  };
}

/**
 * Health check cho embedding service
 */
export async function checkEmbeddingHealth(): Promise<{
  status: 'up' | 'down';
  model: string;
  latency?: number;
  error?: string;
}> {
  try {
    const result = await embedText('health check', { timeout: 5000, retries: 1 });
    return {
      status: 'up',
      model: EMBEDDING_MODEL,
      latency: result.latency,
    };
  } catch (error) {
    return {
      status: 'down',
      model: EMBEDDING_MODEL,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
