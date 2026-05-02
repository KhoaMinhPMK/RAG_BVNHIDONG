/**
 * MiMo API Client
 * OpenAI-compatible interface for MiMo LLM API
 * Base URL: https://token-plan-sgp.xiaomimomo.com/v1
 */

interface MiMoMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface MiMoChatOptions {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
}

interface MiMoChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
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

export class MiMoClient {
  private baseUrl: string;
  private apiKey: string;
  private primaryModel: string;
  private fallbackModel: string;
  private omniModel: string;
  private ttsModel: string;

  constructor() {
    this.baseUrl = process.env.MIMO_BASE_URL || 'https://token-plan-sgp.xiaomimomo.com/v1';
    this.apiKey = process.env.MIMO_API_KEY || '';
    this.primaryModel = process.env.MIMO_MODEL_PRIMARY || 'MiMo-V2.5-Pro';
    this.fallbackModel = process.env.MIMO_MODEL_FALLBACK || 'MiMo-V2.5';
    this.omniModel = process.env.MIMO_MODEL_OMNI || 'MiMo-V2-Omni';
    this.ttsModel = process.env.MIMO_MODEL_TTS || 'MiMo-V2.5-TTS';

    if (!this.apiKey) {
      console.warn('[MiMo] API key not configured');
    }
  }

  /**
   * Chat completion with MiMo API (OpenAI compatible)
   */
  async chat(
    messages: MiMoMessage[],
    options: MiMoChatOptions = {},
    model?: string
  ): Promise<MiMoChatResponse> {
    const targetModel = model || this.primaryModel;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: targetModel,
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.max_tokens ?? 2000,
          top_p: options.top_p ?? 0.9,
          stream: options.stream ?? false,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`MiMo API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      return data as MiMoChatResponse;
    } catch (error) {
      console.error('[MiMo] Chat error:', error);
      throw error;
    }
  }

  /**
   * Analyze image with MiMo-V2-Omni
   */
  async analyzeImage(
    imageBuffer: Buffer,
    prompt: string = 'Analyze this medical image and describe the findings.'
  ): Promise<MiMoImageAnalysisResponse> {
    try {
      // Convert image to base64
      const base64Image = imageBuffer.toString('base64');

      const messages: MiMoMessage[] = [
        {
          role: 'user',
          content: `${prompt}\n\n[Image: data:image/jpeg;base64,${base64Image}]`,
        },
      ];

      const response = await this.chat(messages, { max_tokens: 1000 }, this.omniModel);

      const content = response.choices[0]?.message?.content || '';

      // Parse response (simple extraction)
      return {
        description: content,
        findings: this.extractFindings(content),
        confidence: 0.85, // Placeholder
      };
    } catch (error) {
      console.error('[MiMo] Image analysis error:', error);
      throw error;
    }
  }

  /**
   * Text-to-Speech with MiMo-V2.5-TTS
   */
  async textToSpeech(text: string, voice?: string): Promise<MiMoTTSResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/audio/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.ttsModel,
          input: text,
          voice: voice || 'default',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`MiMo TTS error: ${response.status} - ${error}`);
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());

      return {
        audio: audioBuffer,
        duration: 0, // Placeholder
      };
    } catch (error) {
      console.error('[MiMo] TTS error:', error);
      throw error;
    }
  }

  /**
   * Check if MiMo API is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('[MiMo] Health check failed:', error);
      return false;
    }
  }

  /**
   * Extract findings from analysis text
   */
  private extractFindings(text: string): string[] {
    const findings: string[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
        findings.push(trimmed.substring(1).trim());
      }
    }

    return findings.length > 0 ? findings : [text];
  }
}

// Singleton instance
let mimoClient: MiMoClient | null = null;

export function getMiMoClient(): MiMoClient {
  if (!mimoClient) {
    mimoClient = new MiMoClient();
  }
  return mimoClient;
}
