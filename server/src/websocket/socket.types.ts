// ─── Client → Server Messages ────────────────────────────────────────────────

export interface AudioStartMessage {
  type: 'audio.start';
}

export interface AudioChunkMessage {
  type: 'audio.chunk';
  data: string; // base64-encoded audio
  mimeType?: string; // e.g. 'audio/webm', 'audio/webm;codecs=opus'
}

export interface AudioEndMessage {
  type: 'audio.end';
}

export interface CallEndMessage {
  type: 'call.end';
}

export type ClientMessage =
  | AudioStartMessage
  | AudioChunkMessage
  | AudioEndMessage
  | CallEndMessage;

// ─── Server → Client Messages ────────────────────────────────────────────────

export interface AIGreetingMessage {
  type: 'ai.greeting';
  text: string;
  audio: string | null; // base64-encoded mp3
}

export interface AIProcessingMessage {
  type: 'ai.processing';
}

export interface TranscriptMessage {
  type: 'transcript';
  role: 'user' | 'assistant';
  text: string;
}

export interface AIResponseMessage {
  type: 'ai.response';
  text: string;
  audio: string | null; // base64-encoded mp3
  conversationComplete: boolean;
}

export interface CallEndedMessage {
  type: 'call.ended';
  reportAvailable: boolean;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export type ServerMessage =
  | AIGreetingMessage
  | AIProcessingMessage
  | TranscriptMessage
  | AIResponseMessage
  | CallEndedMessage
  | ErrorMessage;

// ─── Validation ──────────────────────────────────────────────────────────────

const VALID_CLIENT_TYPES = ['audio.start', 'audio.chunk', 'audio.end', 'call.end'];

export function parseClientMessage(data: string): ClientMessage | null {
  try {
    const parsed = JSON.parse(data);
    if (!parsed.type || !VALID_CLIENT_TYPES.includes(parsed.type)) {
      return null;
    }
    return parsed as ClientMessage;
  } catch {
    return null;
  }
}
