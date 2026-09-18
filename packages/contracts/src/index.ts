// P1-REPO-001 seed — shared runtime schemas. Extended by domain tasks (P2+).
import { z } from 'zod';

export const HealthStatusSchema = z.object({
  status: z.literal('ok'),
  version: z.string().min(1),
});
export type HealthStatus = z.infer<typeof HealthStatusSchema>;

export const EnvNameSchema = z.enum([
  'DATABASE_URL',
  'MODEL_PROVIDER',
  'MODEL_API_KEY',
  'APP_SECRET',
  'LOCAL_BLOB_ROOT',
]);
export type EnvName = z.infer<typeof EnvNameSchema>;

export function createHealthStatus(version: string): HealthStatus {
  return HealthStatusSchema.parse({ status: 'ok', version });
}
