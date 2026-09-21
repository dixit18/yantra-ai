// P1-DB-003 — minimal owned migration runner. Files in migrations/ named
// NNNN_name.sql apply in filename order, each inside its own transaction,
// tracked in schema_migrations with a sha256 checksum. A single
// session-scoped advisory lock serializes concurrent runners; a checksum
// mismatch on an applied version fails loudly instead of drifting silently.
// Constraint: migration SQL must be transaction-safe (no CONCURRENTLY).
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { QueryRow } from './check.js';

export interface MigrationConn {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: QueryRow[] }>;
  release: () => void;
}

export interface MigrationFile {
  version: string;
  filename: string;
  sql: string;
}

const FILE_RE = /^(\d{4}_[a-z0-9_]+)\.sql$/;

export function defaultMigrationsDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, '..', 'migrations');
}

export async function discoverMigrations(dir: string): Promise<MigrationFile[]> {
  const names = (await readdir(dir)).filter((n) => n.endsWith('.sql')).sort();
  const files: MigrationFile[] = [];
  for (const name of names) {
    const match = FILE_RE.exec(name);
    if (!match || !match[1]) {
      throw new Error(`bad migration filename: ${name} (want NNNN_name.sql)`);
    }
    files.push({ version: match[1], filename: name, sql: await readFile(join(dir, name), 'utf8') });
  }
  return files;
}

export function checksum(sql: string): string {
  return createHash('sha256').update(sql, 'utf8').digest('hex');
}

export async function migrate(
  connect: () => Promise<MigrationConn>,
  dir: string,
): Promise<string[]> {
  const files = await discoverMigrations(dir);
  const conn = await connect();
  // Session-scoped advisory lock (not xact): held across the per-file
  // transactions below, so concurrent runners truly serialize. Released in
  // finally; a dead runner's lock dies with its session.
  await conn.query("select pg_advisory_lock(hashtext('schema_migrations'))");
  try {
    await conn.query(
      'create table if not exists schema_migrations (version text primary key, applied_at timestamptz not null default now(), checksum text)',
    );
    await conn.query('alter table schema_migrations add column if not exists checksum text');
    const appliedRows = await conn.query('select version, checksum from schema_migrations');
    const applied = new Map(
      appliedRows.rows.map((r) => [String(r['version']), r['checksum'] as string | null]),
    );
    const fresh: string[] = [];
    for (const file of files) {
      const sum = checksum(file.sql);
      if (applied.has(file.version)) {
        const stored = applied.get(file.version);
        if (!stored) {
          await conn.query('update schema_migrations set checksum = $1 where version = $2', [
            sum,
            file.version,
          ]);
        } else if (stored !== sum) {
          throw new Error(
            `migration ${file.version} changed since it was applied (checksum mismatch)`,
          );
        }
        continue;
      }
      await conn.query('begin');
      try {
        await conn.query(file.sql);
        await conn.query('insert into schema_migrations (version, checksum) values ($1, $2)', [
          file.version,
          sum,
        ]);
        await conn.query('commit');
      } catch (error) {
        await conn.query('rollback');
        throw new Error(`migration ${file.version} failed: ${(error as Error).message}`);
      }
      fresh.push(file.version);
    }
    return fresh;
  } finally {
    await conn.query("select pg_advisory_unlock(hashtext('schema_migrations'))");
    conn.release();
  }
}
