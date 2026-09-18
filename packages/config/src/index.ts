// P1-REPO-001 seed for P1-ENV-002 — typed local-config loader (never logs secrets).
export interface LocalConfig {
  localBlobRoot: string;
}

export const DEFAULT_BLOB_ROOT = './data/uploads';

export function loadLocalConfig(env: NodeJS.ProcessEnv = process.env): LocalConfig {
  const raw = env['LOCAL_BLOB_ROOT']?.trim();
  return { localBlobRoot: raw && raw.length > 0 ? raw : DEFAULT_BLOB_ROOT };
}
