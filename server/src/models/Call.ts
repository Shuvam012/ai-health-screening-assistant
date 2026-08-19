import mongoose, { Schema, Document } from 'mongoose';

export interface ICollectedData {
  patientName?: string;
  mainConcern?: string;
  duration?: string;
  severity?: string;
  relatedSymptoms?: string[];
  additionalNotes?: string;
}

export interface ICallMetadata {
  totalTurns: number;
  endReason?: 'completed' | 'user_ended' | 'error' | 'timeout';
}

export type CallStatus = 'created' | 'active' | 'completed' | 'failed';

export interface ICall extends Document {
  status: CallStatus;
  language: string;
  startedAt?: Date;
  endedAt?: Date;
  collectedData: ICollectedData;
  metadata: ICallMetadata;
  createdAt: Date;
  updatedAt: Date;
}

const CollectedDataSchema = new Schema<ICollectedData>(
  {
    patientName: { type: String, default: undefined },
    mainConcern: { type: String, default: undefined },
    duration: { type: String, default: undefined },
    severity: { type: String, default: undefined },
    relatedSymptoms: { type: [String], default: [] },
    additionalNotes: { type: String, default: undefined },
  },
  { _id: false }
);

const CallMetadataSchema = new Schema<ICallMetadata>(
  {
    totalTurns: { type: Number, default: 0 },
    endReason: {
      type: String,
      enum: ['completed', 'user_ended', 'error', 'timeout'],
      default: undefined,
    },
  },
  { _id: false }
);

const CallSchema = new Schema<ICall>(
  {
    status: {
      type: String,
      enum: ['created', 'active', 'completed', 'failed'],
      default: 'created',
      required: true,
      index: true,
    },
    language: {
      type: String,
      default: 'en',
    },
    startedAt: { type: Date, default: undefined },
    endedAt: { type: Date, default: undefined },
    collectedData: {
      type: CollectedDataSchema,
      default: () => ({}),
    },
    metadata: {
      type: CallMetadataSchema,
      default: () => ({ totalTurns: 0 }),
    },
  },
  {
    timestamps: true,
  }
);

export const Call = mongoose.model<ICall>('Call', CallSchema);
