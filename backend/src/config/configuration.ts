import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env once (NestJS ConfigModule also loads it, but we ensure it for the
// TypeORM CLI data-source which runs outside the Nest bootstrap).
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface AppConfig {
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  ANTHROPIC_API_KEY: string;
  JVZOO_SECRET_KEY: string;
  S3_BUCKET_NAME: string;
  S3_ACCESS_KEY_ID: string;
  S3_SECRET_ACCESS_KEY: string;
  S3_REGION: string;
  EMAIL_PROVIDER_API_KEY: string;
  REDIS_URL: string;
  FRONTEND_BASE_URL: string;
  NODE_ENV: string;
  PORT: number;
  /** True when ANTHROPIC_API_KEY looks like a real key (starts with sk-ant- and
   * is not the dev placeholder). When false the AI Engine uses its local mock
   * generator so the whole system is runnable without a real key. */
  AI_USE_REAL_LLM: boolean;
}

function boolFromEnv(v: string | undefined): boolean {
  if (!v) return false;
  return v === '1' || v.toLowerCase() === 'true';
}

export default (): AppConfig => {
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? '';
  const isPlaceholder =
    !anthropicKey ||
    anthropicKey.includes('fake') ||
    anthropicKey.includes('placeholder') ||
    anthropicKey === 'sk-ant-...';

  // AI_USE_REAL_LLM env (if explicitly set) overrides the heuristic; otherwise
  // we only trust a real-looking key in non-development environments.
  const override = process.env.AI_USE_REAL_LLM;
  let aiUseReal: boolean;
  if (override !== undefined) {
    aiUseReal = boolFromEnv(override);
  } else {
    aiUseReal = !isPlaceholder && process.env.NODE_ENV === 'production';
  }

  return {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://localhost:5432/affiliate_launch_kit',
    JWT_SECRET: process.env.JWT_SECRET ?? 'dev-insecure-jwt-secret',
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? 'dev-insecure-refresh-secret',
    ANTHROPIC_API_KEY: anthropicKey,
    JVZOO_SECRET_KEY: process.env.JVZOO_SECRET_KEY ?? 'jvzoo-dev-secret',
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME ?? 'affiliate-launch-kit-exports-dev',
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ?? '',
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ?? '',
    S3_REGION: process.env.S3_REGION ?? 'us-east-1',
    EMAIL_PROVIDER_API_KEY: process.env.EMAIL_PROVIDER_API_KEY ?? '',
    REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
    FRONTEND_BASE_URL: process.env.FRONTEND_BASE_URL ?? 'http://localhost:5173',
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    PORT: parseInt(process.env.PORT ?? '3000', 10),
    AI_USE_REAL_LLM: aiUseReal,
  };
};
