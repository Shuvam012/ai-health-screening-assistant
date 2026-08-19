import { SarvamAIClient } from 'sarvamai';
import { Readable } from 'stream';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

// ─── Interface ───────────────────────────────────────────────────────────────

export interface STTService {
  transcribe(audio: Buffer, mimeType?: string, language?: string): Promise<string>;
}

// ─── Sarvam AI STT Implementation (via official SDK) ────────────────────────

export class SarvamSTTService implements STTService {
  private client: SarvamAIClient;
  private model: string;

  constructor() {
    this.client = new SarvamAIClient({
      apiSubscriptionKey: env.SARVAM_API_KEY,
    });
    this.model = env.SARVAM_STT_MODEL;
  }

  async transcribe(audio: Buffer, mimeType: string = 'audio/wav', language: string = 'en'): Promise<string> {
    try {
      // Convert buffer in memory to a Readable stream
      const fileStream = Readable.from(audio);
      
      // Determine correct mimeType and extension
      let resolvedMimeType = mimeType || 'audio/wav';
      // Strip any parameters (e.g. "audio/webm;codecs=opus" -> "audio/webm")
      if (resolvedMimeType.includes(';')) {
        resolvedMimeType = resolvedMimeType.split(';')[0].trim();
      }
      
      const ext = mimeTypeToExtension(resolvedMimeType);

      logger.info(`[Sarvam STT SDK] Transcribing ${audio.length} bytes (mimeType: ${resolvedMimeType}, model: ${this.model}, language: ${language})`);

      // Call the transcribe method using the correct wrapped metadata structure.
      // Explicitly passing contentType prevents the SDK from defaulting to application/octet-stream,
      // which causes the Sarvam backend ASR model call to fail.
      const response = await this.client.speechToText.transcribe({
        file: {
          data: fileStream,
          contentType: resolvedMimeType,
          filename: `audio.${ext}`,
        },
        model: this.model as any,
        language_code: language === 'hi' ? 'hi-IN' : 'en-IN',
        mode: 'transcribe',
        sample_rate: 16000,
        with_timestamps: false,
      } as any);

      const transcript = (response.transcript || '').trim();
      logger.info(`[Sarvam STT SDK] Transcription success: "${transcript}"`);
      return transcript;
    } catch (error) {
      logger.error('[Sarvam STT SDK] Transcription failed:', error);
      throw error;
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createSTTService(): STTService {
  logger.info(`Using Sarvam STT provider via official SDK (model: ${env.SARVAM_STT_MODEL})`);
  return new SarvamSTTService();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mimeTypeToExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/wav': 'wav',
    'audio/mp3': 'mp3',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'mp4',
    'audio/m4a': 'm4a',
    'audio/ogg': 'ogg',
    'audio/flac': 'flac',
  };
  return map[mimeType] || 'wav';
}
