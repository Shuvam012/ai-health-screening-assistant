import { STTService, createSTTService } from './stt.service';
import { LLMService, LLMResponse, createLLMService } from './llm.service';
import { TTSService, createTTSService } from './tts.service';
import { ConversationService } from '../conversation.service';
import { logger } from '../../utils/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PipelineResult {
  transcript: string;
  aiText: string;
  aiAudio: Buffer | null;
  collectedData: Record<string, unknown>;
  conversationComplete: boolean;
}

export interface GreetingResult {
  text: string;
  audio: Buffer | null;
}

// ─── Pipeline Service ────────────────────────────────────────────────────────

/**
 * Orchestrates the full AI pipeline:
 * Audio → STT → Conversation Context → LLM → State Update → TTS → Response
 *
 * This service is completely decoupled from the WebSocket transport.
 */
export class PipelineService {
  private sttService: STTService;
  private llmService: LLMService;
  private ttsService: TTSService;
  private conversationService: ConversationService;

  constructor(
    sttService?: STTService,
    llmService?: LLMService,
    ttsService?: TTSService,
    conversationService?: ConversationService
  ) {
    this.sttService = sttService || createSTTService();
    this.llmService = llmService || createLLMService();
    this.ttsService = ttsService || createTTSService();
    this.conversationService = conversationService || new ConversationService();
  }

  /**
   * Generate the AI greeting for a new call.
   */
  async generateGreeting(callId: string): Promise<GreetingResult> {
    try {
      // Get greeting from LLM
      const systemPrompt = await this.conversationService.buildSystemPrompt(callId);
      const greetingUserMsg = this.conversationService.getGreetingUserMessage();

      const llmResponse = await this.llmService.chat({
        systemPrompt,
        messages: [{ role: 'user', content: greetingUserMsg }],
        responseFormat: 'json',
      });

      const greetingText = llmResponse.reply;

      // Save greeting message to conversation history
      await this.conversationService.addMessage(callId, 'assistant', greetingText);

      // Generate TTS audio
      let audio: Buffer | null = null;
      try {
        audio = await this.ttsService.synthesize(greetingText);
      } catch (ttsError) {
        logger.warn('TTS failed for greeting, sending text-only:', ttsError);
      }

      return { text: greetingText, audio };
    } catch (error) {
      logger.error('Failed to generate greeting:', error);
      // Fallback greeting
      const fallbackText =
        "Hello! I'm Aegis, your health screening assistant. I'll be asking you a few basic questions about your health. Could you please start by telling me your name?";

      await this.conversationService.addMessage(callId, 'assistant', fallbackText);

      let audio: Buffer | null = null;
      try {
        audio = await this.ttsService.synthesize(fallbackText);
      } catch {
        // Even TTS failed, return text only
      }

      return { text: fallbackText, audio };
    }
  }

  /**
   * Process a user's audio turn through the full pipeline.
   */
  async processAudioTurn(
    callId: string,
    audioBuffer: Buffer,
    mimeType: string = 'audio/wav'
  ): Promise<PipelineResult> {
    // Step 1: Speech-to-Text
    logger.info(`[Pipeline] Processing audio turn: ${audioBuffer.length} bytes, mimeType=${mimeType}`);
    
    let language = 'en';
    try {
      const call = await this.conversationService.getCall(callId);
      if (call && call.language) {
        language = call.language;
      }
    } catch (e) {
      logger.warn('[Pipeline] Failed to load call language, defaulting to en:', e);
    }

    let transcript: string;
    try {
      transcript = await this.sttService.transcribe(audioBuffer, mimeType, language);
      logger.info(`[Pipeline] STT result: "${transcript}"`);
    } catch (error) {
      logger.error('[Pipeline] STT failed:', error);
      return await this.createErrorResult(
        "I'm sorry, I couldn't process your audio. Could you please try speaking again?"
      );
    }

    // Handle empty/unclear transcript
    if (!transcript || transcript.trim().length === 0) {
      logger.warn('[Pipeline] STT returned empty transcript');
      return await this.createErrorResult(
        "I couldn't quite catch that. Could you please repeat what you said?"
      );
    }

    // Step 2: Save user message
    await this.conversationService.addMessage(callId, 'user', transcript);

    // Step 3: Build LLM context
    const systemPrompt = await this.conversationService.buildSystemPrompt(callId);
    const conversationHistory = await this.conversationService.buildLLMMessages(callId);

    // Step 4: LLM Processing
    let llmResponse: LLMResponse;
    try {
      llmResponse = await this.llmService.chat({
        systemPrompt,
        messages: conversationHistory,
        responseFormat: 'json',
      });
      logger.info(`[Pipeline] LLM reply: "${llmResponse.reply.substring(0, 100)}..."`);
    } catch (error) {
      logger.error('[Pipeline] LLM failed:', error);
      return await this.createErrorResult(
        "I'm having a bit of trouble processing that. Could you please repeat your response?",
        transcript
      );
    }

    // Step 5: Update collected data
    const updatedData = await this.conversationService.updateCollectedData(
      callId,
      llmResponse.collectedData as Record<string, unknown>
    );

    // Save AI response message
    await this.conversationService.addMessage(callId, 'assistant', llmResponse.reply);

    // Increment turn count
    await this.conversationService.incrementTurnCount(callId);

    // Step 6: Text-to-Speech
    let aiAudio: Buffer | null = null;
    try {
      aiAudio = await this.ttsService.synthesize(llmResponse.reply);
    } catch (ttsError) {
      logger.warn('TTS failed, returning text-only response:', ttsError);
    }

    // Step 7: Return result
    return {
      transcript,
      aiText: llmResponse.reply,
      aiAudio,
      collectedData: updatedData as unknown as Record<string, unknown>,
      conversationComplete: llmResponse.conversationComplete,
    };
  }

  /**
   * Create an error result with a user-friendly message.
   */
  private async createErrorResult(
    errorMessage: string,
    transcript: string = ''
  ): Promise<PipelineResult> {
    // Also synthesize the error responses so the voice remains high quality
    let aiAudio: Buffer | null = null;
    try {
      aiAudio = await this.ttsService.synthesize(errorMessage);
    } catch (error) {
      logger.warn('[Pipeline] Failed to synthesize error response audio:', error);
    }

    return {
      transcript,
      aiText: errorMessage,
      aiAudio,
      collectedData: {},
      conversationComplete: false,
    };
  }
}
