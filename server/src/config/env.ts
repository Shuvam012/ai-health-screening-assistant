import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface EnvConfig {
  PORT: number;
  NODE_ENV: string;
  LOG_LEVEL: string;
  MONGODB_URI: string;
  // API Keys
  SARVAM_API_KEY: string;
  GEMINI_API_KEY: string;
  GROQ_API_KEY: string;
  COHERE_API_KEY: string;
  // Providers
  STT_PROVIDER: 'sarvam';
  LLM_PROVIDER: 'gemini' | 'cohere';
  TTS_PROVIDER: 'sarvam';
  // Model configs
  SARVAM_STT_MODEL: string;
  SARVAM_TTS_MODEL: string;
  GEMINI_MODEL: string;
  COHERE_MODEL: string;
  CORS_ORIGIN: string;
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function validateSttProvider(value: string): 'sarvam' {
  if (value !== 'sarvam') {
    throw new Error(`Invalid STT_PROVIDER: "${value}". Must be "sarvam".`);
  }
  return value;
}

function validateLlmProvider(value: string): 'gemini' | 'cohere' {
  if (value !== 'gemini' && value !== 'cohere') {
    throw new Error(`Invalid LLM_PROVIDER: "${value}". Must be "gemini" or "cohere".`);
  }
  return value;
}

function validateTtsProvider(value: string): 'sarvam' {
  if (value !== 'sarvam') {
    throw new Error(`Invalid TTS_PROVIDER: "${value}". Must be "sarvam".`);
  }
  return value;
}

export const env: EnvConfig = {
  PORT: parseInt(getEnvVar('PORT', '3001'), 10),
  NODE_ENV: getEnvVar('NODE_ENV', 'development'),
  LOG_LEVEL: getEnvVar('LOG_LEVEL', 'info'),
  MONGODB_URI: getEnvVar('MONGODB_URI', 'mongodb://localhost:27017/health-screening'),
  // API Keys
  SARVAM_API_KEY: getEnvVar('SARVAM_API_KEY', ''),
  GEMINI_API_KEY: getEnvVar('GEMINI_API_KEY', ''),
  GROQ_API_KEY: getEnvVar('GROQ_API_KEY', ''),
  COHERE_API_KEY: getEnvVar('COHERE_API_KEY', ''),
  // Providers
  STT_PROVIDER: validateSttProvider(getEnvVar('STT_PROVIDER', 'sarvam')),
  LLM_PROVIDER: validateLlmProvider(getEnvVar('LLM_PROVIDER', 'gemini')),
  TTS_PROVIDER: validateTtsProvider(getEnvVar('TTS_PROVIDER', 'sarvam')),
  // Model configs
  SARVAM_STT_MODEL: getEnvVar('SARVAM_STT_MODEL', 'saaras:v4'),
  SARVAM_TTS_MODEL: getEnvVar('SARVAM_TTS_MODEL', 'bulbul:v3'),
  GEMINI_MODEL: getEnvVar('GEMINI_MODEL', 'gemini-3.6-flash'),
  COHERE_MODEL: getEnvVar('COHERE_MODEL', 'command-r-08-2024'),
  CORS_ORIGIN: getEnvVar('CORS_ORIGIN', 'http://localhost:5173'),
};

/** Validate that API keys are present for the selected providers */
export function validateApiKeys(): void {
  if (env.STT_PROVIDER === 'sarvam' && !env.SARVAM_API_KEY) {
    throw new Error(
      'SARVAM_API_KEY is required when STT_PROVIDER is "sarvam". Set it in .env.'
    );
  }

  if (env.TTS_PROVIDER === 'sarvam' && !env.SARVAM_API_KEY) {
    throw new Error(
      'SARVAM_API_KEY is required when TTS_PROVIDER is "sarvam". Set it in .env.'
    );
  }

  if (env.LLM_PROVIDER === 'gemini' && !env.GEMINI_API_KEY) {
    throw new Error(
      'GEMINI_API_KEY is required when LLM_PROVIDER is "gemini". Set it in .env.'
    );
  }



  if (env.LLM_PROVIDER === 'cohere' && !env.COHERE_API_KEY) {
    throw new Error(
      'COHERE_API_KEY is required when LLM_PROVIDER is "cohere". Set it in .env.'
    );
  }
}
