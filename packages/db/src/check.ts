// P1-ENV-002 — database health check. The query seam keeps unit tests honest
// (fake rows) while integration tests run the same code against real Postgres.
import { Pool } from 'pg';

export type QueryRow = Record<string, unknown>;
export type QueryFn = (sql: string) => Promise<{ rows: QueryRow[] }>;

export interface DatabaseHealth {
  reachable: boolean;
  serverVersion: string;
  vectorInstalled: boolean;
  vectorVersion: string | null;
}

export async function checkDatabase(query: QueryFn): Promise<DatabaseHealth> {
  const versionRows = await query('select version() as version');
  const rawVersion = versionRows.rows[0]?.['version'];
  const serverVersion = typeof rawVersion === 'string' ? rawVersion : '';
  if (!serverVersion) {
    throw new Error('database did not return a version string');
  }
  const extRows = await query("select extversion from pg_extension where extname = 'vector'");
  const extVersion = extRows.rows[0]?.['extversion'];
  const vectorInstalled = typeof extVersion === 'string';
  return {
    reachable: true,
    serverVersion,
    vectorInstalled,
    vectorVersion: vectorInstalled ? (extVersion as string) : null,
  };
}

export interface PostgresHandle {
  query: QueryFn;
  close: () => Promise<void>;
}

export function createPostgresQuery(connectionString: string): PostgresHandle {
  const pool = new Pool({
    connectionString,
    max: 2,
    connectionTimeoutMillis: 10_000,
    query_timeout: 8_000,
    statement_timeout: 5_000,
  });
  return {
    query: async (sql: string) => ({ rows: (await pool.query(sql)).rows as QueryRow[] }),
    close: () => pool.end(),
  };
}
