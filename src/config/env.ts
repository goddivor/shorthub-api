import dotenv from 'dotenv';

dotenv.config();

interface EnvConfig {
  NODE_ENV: string;
  PORT: number;
  MONGODB_URI: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
  YOUTUBE_API_KEY?: string;
  EMAIL_HOST?: string;
  EMAIL_PORT?: number;
  EMAIL_SECURE?: boolean;
  EMAIL_USER?: string;
  EMAIL_PASSWORD?: string;
  EMAIL_FROM?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_WHATSAPP_FROM?: string;
  REDIS_HOST?: string;
  REDIS_PORT?: number;
  REDIS_PASSWORD?: string;
  CORS_ORIGIN: string;
  LOG_LEVEL: string;
}

const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

const getEnvVarOptional = (key: string, defaultValue?: string): string | undefined => {
  return process.env[key] || defaultValue;
};

export const env: EnvConfig = {
  NODE_ENV: getEnvVar('NODE_ENV', 'development'),
  PORT: parseInt(getEnvVar('PORT', '4000')),
  MONGODB_URI: getEnvVar('MONGODB_URI'),
  JWT_SECRET: getEnvVar('JWT_SECRET'),
  JWT_REFRESH_SECRET: getEnvVar('JWT_REFRESH_SECRET'),
  JWT_EXPIRES_IN: getEnvVar('JWT_EXPIRES_IN', '7d'),
  JWT_REFRESH_EXPIRES_IN: getEnvVar('JWT_REFRESH_EXPIRES_IN', '30d'),
  YOUTUBE_API_KEY: getEnvVarOptional('YOUTUBE_API_KEY'),
  EMAIL_HOST: getEnvVarOptional('EMAIL_HOST', 'smtp.gmail.com'),
  EMAIL_PORT: parseInt(getEnvVarOptional('EMAIL_PORT', '587') || '587'),
  EMAIL_SECURE: getEnvVarOptional('EMAIL_SECURE', 'false') === 'true',
  EMAIL_USER: getEnvVarOptional('EMAIL_USER'),
  EMAIL_PASSWORD: getEnvVarOptional('EMAIL_PASSWORD'),
  EMAIL_FROM: getEnvVarOptional('EMAIL_FROM', 'ShortHub <noreply@shorthub.com>'),
  TWILIO_ACCOUNT_SID: getEnvVarOptional('TWILIO_ACCOUNT_SID'),
  TWILIO_AUTH_TOKEN: getEnvVarOptional('TWILIO_AUTH_TOKEN'),
  TWILIO_WHATSAPP_FROM: getEnvVarOptional('TWILIO_WHATSAPP_FROM'),
  REDIS_HOST: getEnvVarOptional('REDIS_HOST', 'localhost'),
  REDIS_PORT: parseInt(getEnvVarOptional('REDIS_PORT', '6379') || '6379'),
  REDIS_PASSWORD: getEnvVarOptional('REDIS_PASSWORD'),
  CORS_ORIGIN: getEnvVar('CORS_ORIGIN', 'http://localhost:5173'),
  LOG_LEVEL: getEnvVar('LOG_LEVEL', 'info'),
};
