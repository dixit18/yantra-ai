// P1-ENV-002 — lean environment contract. Real provider secrets are required
// only when a feature genuinely needs them (master spec §24); until then the
// app runs with mocks/fixtures and MODEL_* stays empty.
import { z } from 'zod';

const DatabaseUrlSchema = z
  .string({ error: 'DATABASE_URL is not set (see .env.example)' })
  .min(1, 'DATABASE_URL is not set (see .env.example)')
  .refine((url) => url.startsWith('postgresql://') || url.startsWith('postgres://'), {
    message: 'DATABASE_URL must use the postgresql:// (or postgres://) scheme',
  });

export const LeanEnvSchema = z.object({
  DATABASE_URL: DatabaseUrlSchema,
  MODEL_PROVIDER: z.string().trim().default(''),
  MODEL_API_KEY: z.string().trim().default(''),
  APP_SECRET: z
    .string({ error: 'APP_SECRET is not set (see .env.example)' })
    .min(8, 'APP_SECRET must be at least 8 characters'),
  LOCAL_BLOB_ROOT: z.string().trim().min(1).default('./data/uploads'),
});
export type LeanEnv = z.infer<typeof LeanEnvSchema>;

export function validateLeanEnv(env: NodeJS.ProcessEnv = process.env): LeanEnv {
  return LeanEnvSchema.parse({
    DATABASE_URL: env['DATABASE_URL']?.trim() || undefined,
    MODEL_PROVIDER: env['MODEL_PROVIDER']?.trim() || undefined,
    MODEL_API_KEY: env['MODEL_API_KEY']?.trim() || undefined,
    APP_SECRET: env['APP_SECRET']?.trim() || undefined,
    LOCAL_BLOB_ROOT: env['LOCAL_BLOB_ROOT']?.trim() || undefined,
  });
}

// Safe-to-log database identity: scheme + host + database, never credentials.
export function redactDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.host || 'unknown-host';
    const db = parsed.pathname.replace(/^\//, '') || 'unknown-db';
    return `${parsed.protocol}//***@${host}/${db}`;
  } catch {
    const head = url.split(':', 1)[0] ?? 'unknown';
    return `${head}://***@unparseable`;
  }
}
