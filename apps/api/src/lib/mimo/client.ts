/**
 * MiMo API Client
 * OpenAI-compatible interface for MiMo LLM API
 * Docs: https://platform.xiaomimimo.com/docs/en-US/api/chat/openai-api
 */

// ─── Message types ────────────────────────────────────────────────────────────

export interface MiMoMessage {
  role: 'system' | 'user' | 'assistant' | 'tool' | 'developer';
  content: string | null;
  name?: string;
  tool_calls?: MiMoToolCall[];
  tool_call_id?: string;    // for role='tool'
  reasoning_content?: string; // assistant CoT (keep for multi-turn)
}

export interface MiMoToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface MiMoTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    strict?: boolean;
  };
}

// ─── Options ─────────────────────────────────────────────────────────────────

export interface MiMoChatOptions {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  thinking?: 'enabled' | 'disabled';
  response_format?: { type: 'text' | 'json_object' };
}

// ─── Responses ────────────────────────────────────────────────────────────────

export interface MiMoChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      reasoning_content?: string;
      tool_calls?: MiMoToolCall[] | null;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    completion_tokens_details?: { reasoning_tokens: number };
  };
}

/** Callbacks for CAE agent streaming loop */
export interface CAECallbacks {
  onThinking?: (delta: string) => void;
  onToolStart?: (name: string, args: Record<string, unknown>) => void;
  onToolDone?: (name: string, preview: string) => void;
  onContent?: (delta: string) => void;
  onDone?: (usage: MiMoChatResponse['usage'] | null) => void;
}

interface MiMoImageAnalysisResponse {
  description: string;
  findings: string[];
  confidence: number;
}

interface MiMoTTSResponse {
  audio: Buffer;
  duration: number;
}

// ─── Client ───────────────────────────────────────────────────────────────────

export class MiMoClient {
  private baseUrl: string;
  private apiKey: string;
  private primaryModel: string;
  private fallbackModel: string;
  private omniModel: string;
  private ttsModel: string;

  constructor() {
    this.baseUrl = process.env.MIMO_BASE_URL || 'https://api.xiaomimimo.com/v1';
    this.apiKey = process.env.MIMO_API_KEY || '';
    this.primaryModel = process.env.MIMO_MODEL_PRIMARY || 'mimo-v2.5-pro';
    this.fallbackModel = process.env.MIMO_MODEL_FALLBACK || 'mimo-v2.5';
    this.omniModel = process.env.MIMO_MODEL_OMNI || 'mimo-v2-omni';
    this.ttsModel = process.env.MIMO_MODEL_TTS || 'mimo-v2.5-tts';

    if (!this.apiKey) {
      console.warn('[MiMo] API key not configured');
    }
  }

  private getHeaders(includeJsonContentType: boolean = true): Record<string, string> {
    return {
      ...(includeJsonContentType ? { 'Content-Type': 'application/json' } : {}),
      'api-key': this.apiKey,
    };
  }

  // ─── Basic chat (non-streaming, no tools) ──────────────────────────────────

  async chat(
    messages: MiMoMessage[],
    options: MiMoChatOptions = {},
    model?: string
  ): Promise<MiMoChatResponse> {
    const targetModel = model || this.primaryModel;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: targetModel,
        messages,
        temperature: options.temperature ?? 1.0,
        max_completion_tokens: options.max_tokens ?? 2048,
        top_p: options.top_p ?? 0.95,
        stream: false,
        frequency_penalty: 0,
        presence_penalty: 0,
        stop: null,
        thinking: { type: options.thinking ?? 'disabled' },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MiMo API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<MiMoChatResponse>;
  }

  // ─── Agentic streaming loop with tool calling ─────────────────────────────
  /**
   * Run a full agent loop: stream tokens, execute tool calls automatically,
   * stream the final answer — all via callbacks.
   *
   * max 6 iterations to prevent infinite loops.
   */
  async chatStreamAgent(
    messages: MiMoMessage[],
    tools: MiMoTool[],
    toolExecutor: (name: string, args: Record<string, unknown>) => Promise<string>,
    options: MiMoChatOptions = {},
    callbacks: CAECallbacks = {}
  ): Promise<void> {
    const history: MiMoMessage[] = [...messages];
    const MAX_ITER = 6;

    for (let iter = 0; iter < MAX_ITER; iter++) {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: this.primaryModel,
          messages: history,
          tools: tools.length > 0 ? tools : undefined,
          tool_choice: tools.length > 0 ? 'auto' : undefined,
          stream: true,
          thinking: { type: options.thinking ?? 'enabled' },
          temperature: options.temperature ?? 1.0,
          max_completion_tokens: options.max_tokens ?? 4096,
          top_p: options.top_p ?? 0.95,
          frequency_penalty: 0,
          presence_penalty: 0,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => '(no body)');
        throw new Error(`MiMo stream error: HTTP ${response.status} - ${errBody}`);
      }

      if (!response.body) {
        throw new Error('MiMo stream error: response body is null');
      }

      // Parse SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let collectedContent = '';
      let collectedReasoning = '';
      // indexed by tool_calls[].index
      const toolCallMap: Record<number, { id: string; name: string; args: string }> = {};
      let finishReason = '';
      let lastUsage: MiMoChatResponse['usage'] | null = null;
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') break;

          let chunk: any;
          try { chunk = JSON.parse(raw); } catch { continue; }

          const choice = chunk.choices?.[0];
          if (!choice) {
            if (chunk.usage) lastUsage = chunk.usage;
            continue;
          }

          finishReason = choice.finish_reason || finishReason;
          const delta = choice.delta ?? {};

          // Chain-of-thought (reasoning)
          if (delta.reasoning_content) {
            collectedReasoning += delta.reasoning_content;
            callbacks.onThinking?.(delta.reasoning_content);
          }

          // Regular content
          if (delta.content) {
            collectedContent += delta.content;
            callbacks.onContent?.(delta.content);
          }

          // Tool calls accumulation
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx: number = tc.index ?? 0;
              if (!toolCallMap[idx]) {
                toolCallMap[idx] = { id: '', name: '', args: '' };
              }
              if (tc.id) toolCallMap[idx].id = tc.id;
              if (tc.function?.name) toolCallMap[idx].name = tc.function.name;
              if (tc.function?.arguments) toolCallMap[idx].args += tc.function.arguments;
            }
          }
        }
      }

      // If tool calls requested → execute and continue
      if (finishReason === 'tool_calls' && Object.keys(toolCallMap).length > 0) {
        // Add assistant message (with tool_calls) to history
        history.push({
          role: 'assistant',
          content: collectedContent || null,
          reasoning_content: collectedReasoning || undefined,
          tool_calls: Object.values(toolCallMap).map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: tc.args },
          })),
        });

        // Execute each tool
        for (const tc of Object.values(toolCallMap)) {
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(tc.args || '{}'); } catch {}

          callbacks.onToolStart?.(tc.name, args);

          let result = '';
          try {
            result = await toolExecutor(tc.name, args);
          } catch (e) {
            result = `Tool error: ${e instanceof Error ? e.message : String(e)}`;
          }
          callbacks.onToolDone?.(tc.name, result.slice(0, 300));

          history.push({
            role: 'tool',
            content: result,
            tool_call_id: tc.id,
          });
        }

        // Loop back for next model response
        continue;
      }

      // Final answer reached
      callbacks.onDone?.(lastUsage);
      break;
    }
  }

  // ─── Text-to-Speech ───────────────────────────────────────────────────────

  async textToSpeech(
    text: string,
    voice: string = 'mimo_default'
  ): Promise<Buffer> {
    const response = await fetch(`${this.baseUrl}/audio/speech`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: this.ttsModel,
        input: text,
        voice,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`MiMo TTS error: ${response.status} - ${err}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  // ─── Image analysis (Omni model) ─────────────────────────────────────────

  async analyzeImage(
    imageBuffer: Buffer,
    prompt: string = 'Analyze this medical image and describe the findings.'
  ): Promise<MiMoImageAnalysisResponse> {
    const base64Image = imageBuffer.toString('base64');

    const result = await this.chat(
      [{ role: 'user', content: `${prompt}\n\n[Image: data:image/jpeg;base64,${base64Image}]` }],
      { max_tokens: 1000 },
      this.omniModel
    );

    const content = result.choices[0]?.message?.content || '';
    return {
      description: content,
      findings: this.extractFindings(content),
      confidence: 0.85,
    };
  }

  private extractFindings(content: string): string[] {
    const lines = content.split('\n').filter(l => l.trim().startsWith('-') || l.trim().match(/^\d+\./));
    return lines.map(l => l.replace(/^[-\d.]\s*/, '').trim()).filter(Boolean);
  }

  // ─── Health check ─────────────────────────────────────────────────────────

  async isAvailable(): Promise<boolean> {
    try {
      await this.chat([{ role: 'user', content: 'ping' }], { max_tokens: 4, thinking: 'disabled' });
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton
let _client: MiMoClient | null = null;
export function getMiMoClient(): MiMoClient {
  if (!_client) _client = new MiMoClient();
  return _client;
}
