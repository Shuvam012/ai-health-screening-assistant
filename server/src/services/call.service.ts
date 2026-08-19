import { Call, ICall, CallStatus } from '../models/Call';
import { logger } from '../utils/logger';

/**
 * Manages call lifecycle and CRUD operations.
 */
export class CallService {
  /**
   * Create a new call/session.
   */
  async createCall(language: string = 'en'): Promise<ICall> {
    const call = await Call.create({
      status: 'created',
      language,
      collectedData: {},
      metadata: { totalTurns: 0 },
    });

    logger.info(`Call created: ${call._id} (language: ${language})`);
    return call;
  }

  /**
   * Get call by ID.
   */
  async getCall(callId: string): Promise<ICall> {
    const call = await Call.findById(callId).exec();
    if (!call) {
      throw new CallNotFoundError(callId);
    }
    return call;
  }

  /**
   * Transition call to active status.
   */
  async startCall(callId: string): Promise<ICall> {
    const call = await this.getCall(callId);

    if (call.status !== 'created') {
      throw new InvalidCallStateError(callId, call.status, 'created');
    }

    call.status = 'active';
    call.startedAt = new Date();
    await call.save();

    logger.info(`Call started: ${callId}`);
    return call;
  }

  /**
   * End a call (mark as completed).
   */
  async endCall(
    callId: string,
    reason: 'completed' | 'user_ended' = 'completed'
  ): Promise<ICall> {
    const call = await this.getCall(callId);

    if (call.status !== 'active' && call.status !== 'created') {
      throw new InvalidCallStateError(callId, call.status, 'active');
    }

    call.status = 'completed';
    call.endedAt = new Date();
    call.metadata.endReason = reason;
    await call.save();

    logger.info(`Call ended: ${callId} (reason: ${reason})`);
    return call;
  }

  /**
   * Mark a call as failed.
   */
  async failCall(callId: string, reason: string = 'error'): Promise<ICall> {
    const call = await this.getCall(callId);

    call.status = 'failed';
    call.endedAt = new Date();
    call.metadata.endReason = 'error';
    await call.save();

    logger.error(`Call failed: ${callId} (reason: ${reason})`);
    return call;
  }

  /**
   * Check if a call can accept new interactions.
   */
  isCallActive(call: ICall): boolean {
    return call.status === 'active';
  }
}

// ─── Custom Errors ───────────────────────────────────────────────────────────

export class CallNotFoundError extends Error {
  public readonly statusCode = 404;
  constructor(callId: string) {
    super(`Call not found: ${callId}`);
    this.name = 'CallNotFoundError';
  }
}

export class InvalidCallStateError extends Error {
  public readonly statusCode = 400;
  constructor(callId: string, currentState: CallStatus, expectedState: string) {
    super(
      `Call ${callId} is in "${currentState}" state, expected "${expectedState}"`
    );
    this.name = 'InvalidCallStateError';
  }
}
