import mongoose, { Schema, Document, Types } from 'mongoose';

export type ReportCompleteness = 'complete' | 'partial' | 'minimal';

export interface IHealthReport extends Document {
  callId: Types.ObjectId;
  patientName: string;
  mainConcern: string;
  symptoms: string[];
  duration: string;
  severity: string;
  relatedSymptoms: string[];
  followUpPoints: string[];
  completeness: ReportCompleteness;
  summary: string;
  disclaimer: string;
  generatedAt: Date;
}

const HealthReportSchema = new Schema<IHealthReport>({
  callId: {
    type: Schema.Types.ObjectId,
    ref: 'Call',
    required: true,
    unique: true,
    index: true,
  },
  patientName: {
    type: String,
    default: 'Not provided',
  },
  mainConcern: {
    type: String,
    default: 'Not provided',
  },
  symptoms: {
    type: [String],
    default: [],
  },
  duration: {
    type: String,
    default: 'Not provided',
  },
  severity: {
    type: String,
    default: 'Not provided',
  },
  relatedSymptoms: {
    type: [String],
    default: [],
  },
  followUpPoints: {
    type: [String],
    default: [],
  },
  completeness: {
    type: String,
    enum: ['complete', 'partial', 'minimal'],
    default: 'minimal',
    required: true,
  },
  summary: {
    type: String,
    default: '',
  },
  disclaimer: {
    type: String,
    default:
      'This is an AI-generated health screening summary and does NOT constitute a medical diagnosis. Please consult a qualified healthcare professional for proper medical advice.',
  },
  generatedAt: {
    type: Date,
    default: Date.now,
  },
});

export const HealthReport = mongoose.model<IHealthReport>('HealthReport', HealthReportSchema);
