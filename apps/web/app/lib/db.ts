// Server-only database access for route handlers. Single pool per process
// (Next dev HMR safe via globalThis); every query stays tenant-scoped at the
// call site — this helper authenticates nothing by itself.
import { Pool } from 'pg';
import { POSTGRES_POOL_OPTIONS, type QueryRow } from '@yantra/db';

const globalForDb = globalThis as unknown as { __yantraPool?: Pool };

export function getPool(): Pool {
  if (!globalForDb.__yantraPool) {
    const connectionString = process.env['DATABASE_URL'];
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set (see .env.example)');
    }
    globalForDb.__yantraPool = new Pool({ connectionString, ...POSTGRES_POOL_OPTIONS });
  }
  return globalForDb.__yantraPool;
}

export async function dbQuery(sql: string, params?: unknown[]): Promise<{ rows: QueryRow[] }> {
  const pool = getPool();
  return { rows: (await pool.query(sql, params)).rows as QueryRow[] };
}
