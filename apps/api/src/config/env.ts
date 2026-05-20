// Env Zod-validated. Falla fast si falta algo crítico.
// .env solo en dev — en prod las vars vienen del panel de Hostinger.
import 'dotenv/config';
import { z } from 'zod';

// z.coerce.boolean() trata cualquier string no vacío como true (incluye "false").
// Esto interpreta strings de env correctamente: "true"/"1" → true, "false"/"0"/"" → false.
const boolFromEnv = z.preprocess(
  (v) => (typeof v === 'string' ? v === 'true' || v === '1' : v),
  z.boolean(),
);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().min(1),
  DB_CONNECTION_LIMIT: z.coerce.number().int().positive().default(10),

  SESSION_COOKIE_NAME: z.string().default('tc_session'),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 30),
  SESSION_COOKIE_SECURE: boolFromEnv.default(false),
  SESSION_COOKIE_DOMAIN: z.string().optional().transform((v) => (v && v.length ? v : undefined)),

  ARGON_MEMORY_KIB: z.coerce.number().int().positive().default(19456),
  ARGON_ITERATIONS: z.coerce.number().int().positive().default(2),
  ARGON_PARALLELISM: z.coerce.number().int().positive().default(1),

  N8N_BASE_URL: z.string().url().optional().or(z.literal('')),
  N8N_HMAC_SECRET: z.string().optional().default(''),
  N8N_WEBHOOK_AUTH_EMAILS: z.string().default('/webhook/auth-emails'),

  ANTHROPIC_API_KEY: z.string().optional().default(''),
  GROQ_API_KEY: z.string().optional().default(''),
  // Master key para cifrar secretos almacenados en DB (org_api_keys, etc.)
  // En prod debe ser ≥32 chars random y NO debe rotarse a la ligera (rompe secretos viejos).
  ENCRYPTION_KEY: z.string().optional().default(''),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('[env] inválido:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const corsOrigins = env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
export const isProd = env.NODE_ENV === 'production';
