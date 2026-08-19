import { Types } from 'mongoose';
import { Message, IMessage, MessageRole } from '../models/Message';
import { Call, ICollectedData } from '../models/Call';
import { ChatMessage } from './ai/llm.service';
import {
  buildConversationSystemPrompt,
  getGreetingPrompt,
} from '../prompts/conversation.prompt';
import { logger } from '../utils/logger';

/**
 * Manages conversation state and message history for a call.
 */
export class ConversationService {
  /**
   * Retrieve the full conversation history for a call, ordered by sequence.
   */
  async getConversationHistory(callId: string): Promise<IMessage[]> {
    return Message.find({ callId: new Types.ObjectId(callId) })
      .sort({ sequence: 1 })
      .exec();
  }

  /**
   * Add a new message to the conversation.
   */
  async addMessage(callId: string, role: MessageRole, text: string): Promise<IMessage> {
    const lastMessage = await Message.findOne({ callId: new Types.ObjectId(callId) })
      .sort({ sequence: -1 })
      .exec();

    const sequence = lastMessage ? lastMessage.sequence + 1 : 0;

    const message = await Message.create({
      callId: new Types.ObjectId(callId),
      role,
      text,
      sequence,
      timestamp: new Date(),
    });

    logger.debug(`Message added: [${role}] seq=${sequence} "${text.substring(0, 60)}..."`);
    return message;
  }

  /**
   * Get the call metadata.
   */
  async getCall(callId: string) {
    return Call.findById(callId).exec();
  }

  /**
   * Get the currently collected health data from the call.
   */
  async getCollectedData(callId: string): Promise<ICollectedData> {
    const call = await Call.findById(callId).exec();
    if (!call) {
      throw new Error(`Call not found: ${callId}`);
    }
    return call.collectedData || {};
  }

  /**
   * Merge newly extracted data into the call's collectedData.
   * Only updates fields that have new non-null values.
   */
  async updateCollectedData(
    callId: string,
    newData: Record<string, unknown>
  ): Promise<ICollectedData> {
    const call = await Call.findById(callId).exec();
    if (!call) {
      throw new Error(`Call not found: ${callId}`);
    }

    const current = call.collectedData || {};
    const updateFields: Record<string, unknown> = {};

    // Only update non-null, non-undefined fields
    if (newData.patientName && typeof newData.patientName === 'string') {
      updateFields['collectedData.patientName'] = newData.patientName;
    }
    if (newData.mainConcern && typeof newData.mainConcern === 'string') {
      updateFields['collectedData.mainConcern'] = newData.mainConcern;
    }
    if (newData.duration && typeof newData.duration === 'string') {
      updateFields['collectedData.duration'] = newData.duration;
    }
    if (newData.severity && typeof newData.severity === 'string') {
      updateFields['collectedData.severity'] = newData.severity;
    }
    if (newData.relatedSymptoms && Array.isArray(newData.relatedSymptoms)) {
      // Merge with existing symptoms, deduplicate
      const existing = current.relatedSymptoms || [];
      const merged = [...new Set([...existing, ...newData.relatedSymptoms])];
      updateFields['collectedData.relatedSymptoms'] = merged;
    }
    if (newData.additionalNotes && typeof newData.additionalNotes === 'string') {
      updateFields['collectedData.additionalNotes'] = newData.additionalNotes;
    }

    if (Object.keys(updateFields).length > 0) {
      await Call.findByIdAndUpdate(callId, { $set: updateFields });
      logger.debug(`Updated collected data for call ${callId}:`, updateFields);
    }

    // Return the updated data
    const updatedCall = await Call.findById(callId).exec();
    return updatedCall?.collectedData || {};
  }

  /**
   * Increment the turn counter for a call.
   */
  async incrementTurnCount(callId: string): Promise<void> {
    await Call.findByIdAndUpdate(callId, {
      $inc: { 'metadata.totalTurns': 1 },
    });
  }

  /**
   * Build the LLM message array from conversation history.
   */
  async buildLLMMessages(callId: string): Promise<ChatMessage[]> {
    const history = await this.getConversationHistory(callId);

    return history.map((msg) => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.text,
    }));
  }

  /**
   * Build the system prompt with current collected data.
   */
  async buildSystemPrompt(callId: string): Promise<string> {
    const collectedData = await this.getCollectedData(callId);
    return buildConversationSystemPrompt(collectedData);
  }

  /**
   * Get the greeting prompt for a new call.
   */
  getGreetingUserMessage(): string {
    return getGreetingPrompt();
  }
}
