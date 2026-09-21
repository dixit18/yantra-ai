// P1-DB-003 — minimal owned migration runner. Files in migrations/ named
// NNNN_name.sql apply in filename order inside one outer transaction, with a
// per-file savepoint for file-level atomicity, tracked in schema_migrations
// with a sha256 checksum. A transaction-scoped advisory lock serializes
// concurrent runners (the outer transaction also keeps the runner pinned to
// one server session under transaction pooling). No framework: the mechanism
// fits one review.
// Constraints: migration SQL must be transaction-safe (no CONCURRENTLY);
// checksums fail loudly on post-apply edits instead of drifting silently.
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
  // One outer transaction for the whole batch: under transaction-pooling
  // (PgBouncer/Neon) a checked-out client may otherwise hop server sessions
  // between statements, which silently breaks both multi-statement
  // transactions and session-held advisory locks. Inside an explicit
  // transaction the session is pinned, so the xact-scoped lock below truly
  // serializes concurrent runners, and per-file savepoints keep file-level
  // atomicity. (DDL is transactional in Postgres; CONCURRENTLY ops stay out.)
  await conn.query('begin');
  try {
    await conn.query("select pg_advisory_xact_lock(hashtext('schema_migrations'))");
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
          // No silent backfill: a missing checksum means the row predates
          // checksum tracking, so the operator verifies the file against the
          // applied migration and sets it manually. Blessing disk content
          // automatically would defeat the drift guard.
          throw new Error(
            `migration ${file.version} has no recorded checksum; verify the file matches the applied migration, then update schema_migrations manually`,
          );
        } else if (stored !== sum) {
          throw new Error(
            `migration ${file.version} changed since it was applied (checksum mismatch)`,
          );
        }
        continue;
      }
      // Savepoint names carry the version (validated [0-9a-z_]): concurrent
      // files and user SQL can never collide with a fixed name.
      await conn.query(`savepoint mig_${file.version}`);
      try {
        await conn.query(file.sql);
        await conn.query('insert into schema_migrations (version, checksum) values ($1, $2)', [
          file.version,
          sum,
        ]);
        await conn.query(`release savepoint mig_${file.version}`);
      } catch (error) {
        await conn.query(`rollback to savepoint mig_${file.version}`);
        throw new Error(`migration ${file.version} failed: ${(error as Error).message}`);
      }
      fresh.push(file.version);
    }
    await conn.query('commit');
    return fresh;
  } catch (error) {
    await conn.query('rollback');
    throw error;
  } finally {
    conn.release();
  }
}
