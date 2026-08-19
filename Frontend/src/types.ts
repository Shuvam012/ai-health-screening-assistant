export interface Message {
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: Date;
}

export interface CollectedData {
  patientName?: string;
  mainConcern?: string;
  duration?: string;
  severity?: string;
  relatedSymptoms?: string[];
  additionalNotes?: string;
}

export interface HealthReport {
  patientName: string;
  mainConcern: string;
  symptoms: string[];
  duration: string;
  severity: string;
  relatedSymptoms: string[];
  followUpPoints: string[];
  completeness: 'complete' | 'partial' | 'minimal';
  summary: string;
  disclaimer: string;
  generatedAt: string;
}

export type ScreenState = 'welcome' | 'calling' | 'report';
export type AiStatus = 'idle' | 'speaking' | 'listening' | 'thinking';
export type WsStatus = 'connecting' | 'connected' | 'disconnected';
