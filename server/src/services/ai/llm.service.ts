import { env } from '../../config/env';
import { logger } from '../../utils/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCollectedData {
  patientName?: string | null;
  mainConcern?: string | null;
  duration?: string | null;
  severity?: string | null;
  relatedSymptoms?: string[] | null;
}

export interface LLMResponse {
  reply: string;
  collectedData: LLMCollectedData;
  nextField: string;
  conversationComplete: boolean;
}

export interface LLMChatParams {
  systemPrompt: string;
  messages: ChatMessage[];
  responseFormat?: 'json' | 'text';
}

// ─── Interface ───────────────────────────────────────────────────────────────

export interface LLMService {
  chat(params: LLMChatParams): Promise<LLMResponse>;
  chatRaw(params: LLMChatParams): Promise<string>;
}

// ─── Google Gemini Implementation ───────────────────────────────────────────

export class GeminiLLMService implements LLMService {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = env.GEMINI_API_KEY;
    this.model = env.GEMINI_MODEL;
  }

  async chat(params: LLMChatParams): Promise<LLMResponse> {
    const rawResponse = await this.chatRaw({ ...params, responseFormat: 'json' });
    return this.parseResponse(rawResponse);
  }

  async chatRaw(params: LLMChatParams): Promise<string> {
    try {
      // Build Gemini-format messages
      // Gemini uses 'user' and 'model' roles (not 'assistant')
      const contents = params.messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      const requestBody: any = {
        systemInstruction: {
          parts: [{ text: params.systemPrompt }],
        },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      };

      // Enable JSON mode if requested
      if (params.responseFormat === 'json') {
        requestBody.generationConfig.responseMimeType = 'application/json';
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

      logger.debug(`[Gemini] Sending request to model: ${this.model}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`[Gemini] API error (${response.status}): ${errorText}`);
        throw new Error(`Gemini API returned status ${response.status}`);
      }

      const data: any = await response.json();

      // Extract text from Gemini response
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) {
        logger.error('[Gemini] Empty response:', JSON.stringify(data));
        throw new Error('Empty response from Gemini');
      }

      logger.debug(`[Gemini] Raw response: ${content.substring(0, 200)}...`);
      return content;
    } catch (error) {
      logger.error('[Gemini] LLM failed:', error);
      throw new Error('Gemini LLM processing failed');
    }
  }

  private parseResponse(raw: string): LLMResponse {
    try {
      const parsed = JSON.parse(raw);
      return {
        reply: parsed.reply || 'I apologize, could you please repeat that?',
        collectedData: parsed.collectedData || {},
        nextField: parsed.nextField || 'unknown',
        conversationComplete: parsed.conversationComplete || false,
      };
    } catch (error) {
      logger.warn('[Gemini] Failed to parse JSON response, using raw text as reply');
      return {
        reply: raw.trim() || 'I apologize, could you please repeat that?',
        collectedData: {},
        nextField: 'unknown',
        conversationComplete: false,
      };
    }
  }
}

// ─── Cohere Implementation (Backup) ─────────────────────────────────────────

export class CohereLLMService implements LLMService {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = env.COHERE_API_KEY;
    this.model = env.COHERE_MODEL;
  }

  async chat(params: LLMChatParams): Promise<LLMResponse> {
    const rawResponse = await this.chatRaw({ ...params, responseFormat: 'json' });
    return this.parseResponse(rawResponse);
  }

  async chatRaw(params: LLMChatParams): Promise<string> {
    try {
      const messages = [
        { role: 'system', content: params.systemPrompt },
        ...params.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      ];

      const response = await fetch('https://api.cohere.com/v2/chat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          response_format:
            params.responseFormat === 'json' ? { type: 'json_object' } : undefined,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`[Cohere] API error (${response.status}): ${errorText}`);
        throw new Error(`Cohere API returned status ${response.status}`);
      }

      const data: any = await response.json();
      const content = extractCohereContent(data.message);
      if (!content) {
        throw new Error('Empty response from Cohere');
      }

      logger.debug(`[Cohere] Raw response: ${content.substring(0, 200)}...`);
      return content;
    } catch (error) {
      logger.error('[Cohere] LLM failed:', error);
      throw new Error('Cohere LLM processing failed');
    }
  }

  private parseResponse(raw: string): LLMResponse {
    try {
      const parsed = JSON.parse(raw);
      return {
        reply: parsed.reply || 'I apologize, could you please repeat that?',
        collectedData: parsed.collectedData || {},
        nextField: parsed.nextField || 'unknown',
        conversationComplete: parsed.conversationComplete || false,
      };
    } catch (error) {
      logger.warn('[Cohere] Failed to parse JSON response, using raw text as reply');
      return {
        reply: raw.trim() || 'I apologize, could you please repeat that?',
        collectedData: {},
        nextField: 'unknown',
        conversationComplete: false,
      };
    }
  }
}

function extractCohereContent(message: any): string {
  if (!message || !message.content) return '';
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    const textObj = message.content.find((c: any) => c.type === 'text');
    if (textObj && textObj.text) return textObj.text;
    if (message.content[0] && typeof message.content[0].text === 'string') {
      return message.content[0].text;
    }
  }
  return '';
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createLLMService(provider: string = env.LLM_PROVIDER): LLMService {
  switch (provider) {
    case 'gemini':
      logger.info(`Using Gemini LLM provider (model: ${env.GEMINI_MODEL})`);
      return new GeminiLLMService();
    case 'cohere':
      logger.info(`Using Cohere LLM provider (model: ${env.COHERE_MODEL})`);
      return new CohereLLMService();
    default:
      throw new Error(`Unknown LLM provider: ${provider}. Supported: "gemini", "cohere".`);
  }
}
