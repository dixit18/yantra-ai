import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { QueryRow } from './check.js';
import { checksum, discoverMigrations, migrate, type MigrationConn } from './migrate.js';

interface FakeConn extends MigrationConn {
  log: string[];
  applied: Map<string, string | null>;
  failOn: string | null;
  released: boolean;
}

function fakeConn(applied: [string, string | null][] = [], failOn: string | null = null): FakeConn {
  const conn: FakeConn = {
    log: [],
    applied: new Map(applied),
    failOn,
    released: false,
    query: async (sql: string, params?: unknown[]) => {
      conn.log.push(params && params.length > 0 ? `${sql} [${params.join(',')}]` : sql);
      if (sql.startsWith('select version, checksum')) {
        return {
          rows: [...conn.applied.entries()].map(([version, sum]) => ({ version, checksum: sum })),
        };
      }
      if (sql.startsWith('update schema_migrations set checksum')) {
        conn.applied.set(String(params?.[1] ?? ''), String(params?.[0] ?? ''));
        return { rows: [] };
      }
      if (sql.startsWith('insert into schema_migrations')) {
        conn.applied.set(String(params?.[0] ?? ''), String(params?.[1] ?? ''));
        return { rows: [] };
      }
      if (conn.failOn && sql.includes(conn.failOn)) {
        throw new Error('boom');
      }
      return { rows: [] as QueryRow[] };
    },
    release: () => {
      conn.released = true;
    },
  };
  return conn;
}

async function dirWith(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'yantra-mig-'));
  for (const [name, sql] of Object.entries(files)) {
    await writeFile(join(dir, name), sql);
  }
  return dir;
}

describe('migrate', () => {
  it('locks, then applies pending files in order inside transactions', async () => {
    const dir = await dirWith({
      '0002_second.sql': 'select 2',
      '0001_first.sql': 'select 1',
    });
    const conn = fakeConn();
    const fresh = await migrate(async () => conn, dir);
    expect(fresh).toEqual(['0001_first', '0002_second']);
    expect(conn.log.slice(0, 4)).toEqual([
      'begin',
      expect.stringContaining('pg_advisory_xact_lock'),
      expect.stringContaining('create table if not exists schema_migrations'),
      expect.stringContaining('add column if not exists checksum'),
    ]);
    expect(conn.log).toContain('savepoint mig_0001_first');
    expect(conn.log).toContain(
      `insert into schema_migrations (version, checksum) values ($1, $2) [0001_first,${checksum('select 1')}]`,
    );
    expect(conn.log).toContain('release savepoint mig_0001_first');
    expect(conn.log[conn.log.length - 1]).toBe('commit');
    expect(conn.released).toBe(true);
  });

  it('skips applied versions with matching checksums', async () => {
    const dir = await dirWith({ '0001_first.sql': 'select 1' });
    const conn = fakeConn([['0001_first', checksum('select 1')]]);
    await expect(migrate(async () => conn, dir)).resolves.toEqual([]);
    expect(conn.log.some((s) => s.startsWith('savepoint'))).toBe(false);
  });

  it('refuses to bless a missing checksum instead of backfilling', async () => {
    const dir = await dirWith({ '0001_first.sql': 'select 1' });
    const conn = fakeConn([['0001_first', null]]);
    await expect(migrate(async () => conn, dir)).rejects.toThrow(/no recorded checksum/);
    expect(conn.log.some((s) => s.startsWith('savepoint'))).toBe(false);
  });

  it('refuses silently edited migrations', async () => {
    const dir = await dirWith({ '0001_first.sql': 'select 2 -- edited' });
    const conn = fakeConn([['0001_first', checksum('select 1')]]);
    await expect(migrate(async () => conn, dir)).rejects.toThrow(/checksum mismatch/);
    expect(conn.released).toBe(true);
  });

  it('rolls back, records nothing, and releases on failure', async () => {
    const dir = await dirWith({ '0001_bad.sql': 'select nope' });
    const conn = fakeConn([], 'select nope');
    await expect(migrate(async () => conn, dir)).rejects.toThrow(/migration 0001_bad failed: boom/);
    expect(conn.log).toContain('rollback to savepoint mig_0001_bad');
    expect(conn.log[conn.log.length - 1]).toBe('rollback');
    expect(conn.applied.has('0001_bad')).toBe(false);
    expect(conn.released).toBe(true);
  });

  it('rejects misnamed files before touching the database', async () => {
    const dir = await dirWith({ 'init.sql': 'select 1' });
    const conn = fakeConn();
    await expect(migrate(async () => conn, dir)).rejects.toThrow(/bad migration filename/);
    expect(conn.log).toEqual([]);
  });
});

describe('discoverMigrations', () => {
  it('discovers the shipped migrations in order', async () => {
    const { defaultMigrationsDir } = await import('./migrate.js');
    const files = await discoverMigrations(defaultMigrationsDir());
    expect(files.map((f) => f.version)).toEqual([
      '0001_init',
      '0002_junction_guards',
      '0003_audit_restrict',
      '0004_blob_files',
      '0005_blob_checks',
      '0006_documents',
      '0007_document_guards',
      '0008_supersede_order',
      '0009_transition_contract',
      '0010_segments',
      '0011_retrieval_events',
      '0012_retrieval_guards',
      '0013_agent_runs',
    ]);
    expect(files[0]?.sql ?? '').toContain('create table tenant');
  });
});
