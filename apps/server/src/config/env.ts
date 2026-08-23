import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env file from monorepo root or app directory
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

const envSchema = z.object({
  PORT: z.string().optional().default('5000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CODE_RUNNER_URL: z.string().default('https://ce.judge0.com'),
  CODE_RUNNER_API_KEY: z.string().optional().default(''),
});

function validateEnvironment() {
  const parseResult = envSchema.safeParse({
    PORT: process.env['PORT'],
    NODE_ENV: process.env['NODE_ENV'],
    CORS_ORIGIN: process.env['CORS_ORIGIN'],
    DATABASE_URL:
      process.env['DATABASE_URL'] ||
      'postgresql://codecollab_user:codecollab_dev_pass@localhost:5433/codecollab_db?schema=public',
    JWT_SECRET:
      process.env['JWT_SECRET'] || 'codecollab_dev_jwt_secret_key_change_in_production',
    JWT_EXPIRES_IN: process.env['JWT_EXPIRES_IN'],
    CODE_RUNNER_URL: process.env['CODE_RUNNER_URL'],
    CODE_RUNNER_API_KEY: process.env['CODE_RUNNER_API_KEY'],
  });

  if (!parseResult.success) {
    console.error('❌ CRITICAL ENVIRONMENT VALIDATION FAILURE:');
    parseResult.error.issues.forEach((issue) => {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    });
    process.exit(1);
  }

  const data = parseResult.data;

  // Strict production security checks
  if (data.NODE_ENV === 'production') {
    if (!process.env['JWT_SECRET'] || process.env['JWT_SECRET'] === 'codecollab_dev_jwt_secret_key_change_in_production') {
      console.error('❌ PRODUCTION SECURITY ERROR: JWT_SECRET must be explicitly defined and cannot use default dev secret.');
      process.exit(1);
    }
    if (process.env['JWT_SECRET'].length < 32) {
      console.error('❌ PRODUCTION SECURITY ERROR: JWT_SECRET must be at least 32 characters in production.');
      process.exit(1);
    }
  }

  return {
    port: data.PORT,
    nodeEnv: data.NODE_ENV,
    corsOrigin: data.CORS_ORIGIN,
    databaseUrl: data.DATABASE_URL,
    jwtSecret: data.JWT_SECRET,
    jwtExpiresIn: data.JWT_EXPIRES_IN,
    codeRunnerUrl: data.CODE_RUNNER_URL,
    codeRunnerApiKey: data.CODE_RUNNER_API_KEY,
  };
}

export interface Config {
  port: number;
  nodeEnv: string;
  corsOrigin: string;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  codeRunnerUrl: string;
  codeRunnerApiKey: string;
}

export const config: Config = validateEnvironment();
