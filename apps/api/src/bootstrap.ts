// P1-ENV-002 — lean application bootstrap: validate env, ensure the local
// blob root, check the database. No Redis, object storage, Temporal, Docker,
// or any scale-later dependency is touched — a guard test below enforces that.
import { ensureBlobRoot, loadLocalConfig } from '@yantra/config';
import { redactDatabaseUrl, validateLeanEnv } from '@yantra/contracts';
import { checkDatabase, createPostgresQuery, type DatabaseHealth, type QueryFn } from '@yantra/db';

export interface BootstrapDeps {
  query?: QueryFn;
  close?: () => Promise<void>;
}

export interface BootstrapStatus {
  env: 'valid';
  model: 'live' | 'mock';
  database: DatabaseHealth;
  databaseHost: string;
  blobRoot: string;
}

export async function bootstrap(
  env: NodeJS.ProcessEnv = process.env,
  deps: BootstrapDeps = {},
): Promise<BootstrapStatus> {
  const lean = validateLeanEnv(env);
  const blobRoot = await ensureBlobRoot(loadLocalConfig(env).localBlobRoot);

  let query = deps.query;
  let close = deps.close;
  let owned = false;
  if (!query) {
    const handle = createPostgresQuery(lean.DATABASE_URL);
    query = handle.query;
    close = handle.close;
    owned = true;
  }
  try {
    const database = await checkDatabase(query);
    if (!database.vectorInstalled) {
      throw new Error(
        'pgvector extension is not installed (run: create extension if not exists vector)',
      );
    }
    return {
      env: 'valid',
      model: lean.MODEL_API_KEY && lean.MODEL_PROVIDER ? 'live' : 'mock',
      database,
      databaseHost: redactDatabaseUrl(lean.DATABASE_URL),
      blobRoot,
    };
  } finally {
    if (owned) {
      await close?.();
    }
  }
}
