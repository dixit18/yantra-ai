import { describe, expect, it } from 'vitest';
import { checkDatabase, createPostgresQuery } from './check.js';

describe('checkDatabase (unit, injected query)', () => {
  it('reports version and pgvector state', async () => {
    const health = await checkDatabase(async (sql: string) => {
      if (sql.includes('version()')) {
        return { rows: [{ version: 'PostgreSQL 18.6 on aarch64' }] };
      }
      return { rows: [{ extversion: '0.8.6' }] };
    });
    expect(health).toEqual({
      reachable: true,
      serverVersion: 'PostgreSQL 18.6 on aarch64',
      vectorInstalled: true,
      vectorVersion: '0.8.6',
    });
  });

  it('marks pgvector missing instead of failing', async () => {
    const health = await checkDatabase(async (sql: string) => {
      if (sql.includes('version()')) {
        return { rows: [{ version: 'PostgreSQL 18.6' }] };
      }
      return { rows: [] };
    });
    expect(health.vectorInstalled).toBe(false);
    expect(health.vectorVersion).toBeNull();
  });

  it('throws when no version string comes back', async () => {
    await expect(checkDatabase(async () => ({ rows: [{}] }))).rejects.toThrow(/version string/);
  });
});

// Live check against the supplied PostgreSQL. Skipped without DATABASE_URL so
// `pnpm test` stays green on machines with no database; run it explicitly with
// the variable set (see agent/STATUS.md for the verified Neon evidence).
describe.skipIf(!process.env['DATABASE_URL'])('checkDatabase (live)', () => {
  it('reaches the database and sees pgvector', async () => {
    const handle = createPostgresQuery(process.env['DATABASE_URL'] as string);
    try {
      const health = await handle.query('select 1 as one');
      expect(health.rows).toEqual([{ one: 1 }]);
      const full = await checkDatabase(handle.query);
      expect(full.reachable).toBe(true);
      expect(full.serverVersion).toContain('PostgreSQL');
      expect(full.vectorInstalled).toBe(true);
    } finally {
      await handle.close();
    }
  });
});
