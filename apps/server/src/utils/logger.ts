import { config } from '../config/env';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'jwtsecret',
  'token',
  'authorization',
  'cookie',
  'secret',
  'apikey',
  'code_runner_api_key',
  'sourcecode',
]);

function redactObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(redactObject);
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactObject(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    const timestamp = new Date().toISOString();
    const redactedMeta = meta ? redactObject(meta) : '';
    if (config.nodeEnv === 'production') {
      console.log(JSON.stringify({ timestamp, level: 'INFO', message, meta: redactedMeta }));
    } else {
      console.log(`ℹ️ [${timestamp}] INFO: ${message}`, redactedMeta ? redactedMeta : '');
    }
  },

  warn(message: string, meta?: Record<string, unknown>) {
    const timestamp = new Date().toISOString();
    const redactedMeta = meta ? redactObject(meta) : '';
    if (config.nodeEnv === 'production') {
      console.warn(JSON.stringify({ timestamp, level: 'WARN', message, meta: redactedMeta }));
    } else {
      console.warn(`⚠️ [${timestamp}] WARN: ${message}`, redactedMeta ? redactedMeta : '');
    }
  },

  error(message: string, meta?: Record<string, unknown>) {
    const timestamp = new Date().toISOString();
    const redactedMeta = meta ? redactObject(meta) : '';
    if (config.nodeEnv === 'production') {
      console.error(JSON.stringify({ timestamp, level: 'ERROR', message, meta: redactedMeta }));
    } else {
      console.error(`❌ [${timestamp}] ERROR: ${message}`, redactedMeta ? redactedMeta : '');
    }
  },
};
