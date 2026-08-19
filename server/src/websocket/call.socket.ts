import WebSocket from 'ws';
import { PipelineService } from '../services/ai/pipeline.service';
import { CallService } from '../services/call.service';
import { ReportService } from '../services/report.service';
import {
  parseClientMessage,
  ServerMessage,
  ClientMessage,
} from './socket.types';
import { logger } from '../utils/logger';

/**
 * Handles a WebSocket connection for a single call session.
 */
export class CallSocketHandler {
  private pipelineService: PipelineService;
  private callService: CallService;
  private reportService: ReportService;

  constructor(
    pipelineService?: PipelineService,
    callService?: CallService,
    reportService?: ReportService
  ) {
    this.pipelineService = pipelineService || new PipelineService();
    this.callService = callService || new CallService();
    this.reportService = reportService || new ReportService();
  }

  /**
   * Handle a new WebSocket connection for a call.
   */
  async handleConnection(ws: WebSocket, callId: string): Promise<void> {
    logger.info(`WebSocket connected for call: ${callId}`);

    // Audio buffer for accumulating chunks
    let audioChunks: Buffer[] = [];
    let audioMimeType: string = 'audio/webm';
    let isRecording = false;
    let isProcessing = false;
    let isCallEnded = false;

    // Validate call exists and transition to active
    try {
      const call = await this.callService.getCall(callId);

      if (call.status === 'completed' || call.status === 'failed') {
        this.sendMessage(ws, {
          type: 'error',
          message: 'This call has already ended.',
        });
        ws.close();
        return;
      }

      if (call.status === 'created') {
        await this.callService.startCall(callId);
      }
    } catch (error) {
      logger.error(`Invalid call ${callId}:`, error);
      this.sendMessage(ws, {
        type: 'error',
        message: 'Invalid call ID. Please create a new call first.',
      });
      ws.close();
      return;
    }

    // Send AI greeting
    try {
      const greeting = await this.pipelineService.generateGreeting(callId);
      this.sendMessage(ws, {
        type: 'ai.greeting',
        text: greeting.text,
        audio: greeting.audio ? greeting.audio.toString('base64') : null,
      });
    } catch (error) {
      logger.error('Failed to send greeting:', error);
      this.sendMessage(ws, {
        type: 'error',
        message: 'Failed to initialize the conversation. Please try again.',
      });
    }

    // Handle incoming messages
    ws.on('message', async (data: WebSocket.RawData) => {
      if (isCallEnded) return;

      const raw = data.toString();
      const message = parseClientMessage(raw);

      if (!message) {
        this.sendMessage(ws, {
          type: 'error',
          message: 'Invalid message format. Please send valid JSON.',
        });
        return;
      }

      try {
        await this.handleClientMessage(
          ws,
          callId,
          message,
          {
            audioChunks,
            audioMimeType,
            isRecording,
            isProcessing,
          },
          {
            setRecording: (v: boolean) => { isRecording = v; },
            setProcessing: (v: boolean) => { isProcessing = v; },
            setCallEnded: (v: boolean) => { isCallEnded = v; },
            pushAudioChunk: (chunk: Buffer) => { audioChunks.push(chunk); },
            clearAudioChunks: () => { audioChunks = []; },
            setAudioMimeType: (m: string) => { audioMimeType = m; },
          }
        );
      } catch (error) {
        logger.error(`Error handling message for call ${callId}:`, error);
        this.sendMessage(ws, {
          type: 'error',
          message: 'An error occurred while processing your request.',
        });
      }
    });

    // Handle disconnection
    ws.on('close', async () => {
      logger.info(`WebSocket disconnected for call: ${callId}`);

      if (!isCallEnded) {
        try {
          await this.endCallAndGenerateReport(callId, 'user_ended');
        } catch (error) {
          logger.error(`Error ending call on disconnect ${callId}:`, error);
        }
      }
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error(`WebSocket error for call ${callId}:`, error);
    });
  }

  private async handleClientMessage(
    ws: WebSocket,
    callId: string,
    message: ClientMessage,
    state: { audioChunks: Buffer[]; audioMimeType: string; isRecording: boolean; isProcessing: boolean },
    setters: {
      setRecording: (v: boolean) => void;
      setProcessing: (v: boolean) => void;
      setCallEnded: (v: boolean) => void;
      pushAudioChunk: (chunk: Buffer) => void;
      clearAudioChunks: () => void;
      setAudioMimeType: (m: string) => void;
    }
  ): Promise<void> {
    switch (message.type) {
      case 'audio.start':
        setters.clearAudioChunks();
        setters.setRecording(true);
        logger.debug(`Audio recording started for call ${callId}`);
        break;

      case 'audio.chunk':
        if (!state.isRecording) {
          this.sendMessage(ws, {
            type: 'error',
            message: 'Not recording. Send audio.start first.',
          });
          return;
        }
        if (message.data) {
          const chunk = Buffer.from(message.data, 'base64');
          setters.pushAudioChunk(chunk);
          // Capture the MIME type from the client (e.g. audio/webm)
          if (message.mimeType) {
            setters.setAudioMimeType(message.mimeType);
          }
          logger.info(`[WS AUDIO] received ${chunk.length} bytes, mimeType: ${message.mimeType || 'not specified'}`);
        }
        break;

      case 'audio.end':
        setters.setRecording(false);

        if (state.isProcessing) {
          this.sendMessage(ws, {
            type: 'error',
            message: 'Still processing the previous turn. Please wait.',
          });
          return;
        }

        if (state.audioChunks.length === 0) {
          this.sendMessage(ws, {
            type: 'error',
            message: "I didn't receive any audio. Please try recording again.",
          });
          return;
        }

        setters.setProcessing(true);

        // Send processing indicator
        this.sendMessage(ws, { type: 'ai.processing' });

        try {
          // Combine audio chunks
          const audioBuffer = Buffer.concat(state.audioChunks);
          const mimeType = state.audioMimeType;
          setters.clearAudioChunks();

          logger.info(`[WS AUDIO] Processing ${audioBuffer.length} bytes, mimeType: ${mimeType}`);

          // Run the full pipeline with the correct MIME type from the client
          const result = await this.pipelineService.processAudioTurn(
            callId,
            audioBuffer,
            mimeType
          );

          // Send user transcript
          if (result.transcript) {
            this.sendMessage(ws, {
              type: 'transcript',
              role: 'user',
              text: result.transcript,
            });
          }

          // Send AI response
          this.sendMessage(ws, {
            type: 'ai.response',
            text: result.aiText,
            audio: result.aiAudio ? result.aiAudio.toString('base64') : null,
            conversationComplete: result.conversationComplete,
          });

          // If conversation is complete, auto-end
          if (result.conversationComplete) {
            await this.endCallAndGenerateReport(callId, 'completed');
            setters.setCallEnded(true);
            this.sendMessage(ws, {
              type: 'call.ended',
              reportAvailable: true,
            });
          }
        } catch (error) {
          logger.error(`Pipeline error for call ${callId}:`, error);
          this.sendMessage(ws, {
            type: 'error',
            message:
              "I'm sorry, something went wrong. Could you please try again?",
          });
        } finally {
          setters.setProcessing(false);
        }
        break;

      case 'call.end':
        logger.info(`Client requested end call: ${callId}`);
        setters.setCallEnded(true);

        try {
          await this.endCallAndGenerateReport(callId, 'user_ended');
          this.sendMessage(ws, {
            type: 'call.ended',
            reportAvailable: true,
          });
        } catch (error) {
          logger.error(`Error ending call ${callId}:`, error);
          this.sendMessage(ws, {
            type: 'call.ended',
            reportAvailable: false,
          });
        }
        break;
    }
  }

  private async endCallAndGenerateReport(
    callId: string,
    reason: 'completed' | 'user_ended'
  ): Promise<void> {
    try {
      await this.callService.endCall(callId, reason);
    } catch (error) {
      // Call might already be ended (e.g., on disconnect after call.end)
      logger.debug(`Call ${callId} may already be ended:`, error);
    }

    try {
      await this.reportService.generateReport(callId);
      logger.info(`Report generated for call ${callId}`);
    } catch (error) {
      logger.error(`Failed to generate report for call ${callId}:`, error);
    }
  }

  private sendMessage(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
}
