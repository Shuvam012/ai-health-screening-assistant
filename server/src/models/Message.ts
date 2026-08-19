import mongoose, { Schema, Document, Types } from 'mongoose';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface IMessage extends Document {
  callId: Types.ObjectId;
  role: MessageRole;
  text: string;
  sequence: number;
  timestamp: Date;
}

const MessageSchema = new Schema<IMessage>({
  callId: {
    type: Schema.Types.ObjectId,
    ref: 'Call',
    required: true,
    index: true,
  },
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  sequence: {
    type: Number,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

MessageSchema.index({ callId: 1, sequence: 1 });

export const Message = mongoose.model<IMessage>('Message', MessageSchema);
