import { env } from '../../config/env';
import { logger } from '../../utils/logger';

// ─── Interface ───────────────────────────────────────────────────────────────

export interface TTSService {
  synthesize(text: string): Promise<Buffer | null>;
}

// ─── Sarvam AI TTS Implementation ───────────────────────────────────────────

export class SarvamTTSService implements TTSService {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = env.SARVAM_API_KEY;
    this.model = env.SARVAM_TTS_MODEL;
  }

  async synthesize(text: string): Promise<Buffer | null> {
    try {
      // Sarvam TTS has a character limit per request (~500 chars)
      // Truncate if needed for voice response
      const truncatedText = text.length > 500 ? text.substring(0, 497) + '...' : text;

      logger.info(`[Sarvam TTS] Synthesizing ${truncatedText.length} chars (model: ${this.model})`);

      const response = await fetch('https://api.sarvam.ai/text-to-speech', {
        method: 'POST',
        headers: {
          'api-subscription-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: [truncatedText],
          target_language_code: 'en-IN',
          speaker: 'ritu',
          model: this.model,
          enable_preprocessing: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`[Sarvam TTS] API error (${response.status}): ${errorText}`);
        throw new Error(`Sarvam TTS API returned status ${response.status}`);
      }

      const data: any = await response.json();

      if (data.audios && data.audios.length > 0) {
        const audioBuffer = Buffer.from(data.audios[0], 'base64');
        logger.info(`[Sarvam TTS] Generated ${audioBuffer.length} bytes of audio`);
        return audioBuffer;
      }

      logger.warn('[Sarvam TTS] No audio in response');
      return null;
    } catch (error) {
      logger.error('[Sarvam TTS] Failed:', error);
      throw error; // Let the caller catch the synthesis error directly
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createTTSService(): TTSService {
  logger.info(`Using Sarvam TTS provider (model: ${env.SARVAM_TTS_MODEL})`);
  return new SarvamTTSService();
}
