import { describe, expect, it } from 'vitest';
import type { QueryFn, QueryRow } from './check.js';
import type { MigrationConn } from './migrate.js';
import { DEMO_PERMISSIONS, seedDemoTenant } from './seed.js';

function scripted(responses: Record<string, QueryRow[]>): {
  connect: () => Promise<MigrationConn>;
  seen: string[];
  params: unknown[][];
} {
  const seen: string[] = [];
  const params: unknown[][] = [];
  const query: QueryFn = async (sql: string, p?: unknown[]) => {
    seen.push(sql);
    params.push(p ?? []);
    for (const [fragment, rows] of Object.entries(responses)) {
      if (sql.includes(fragment)) {
        return { rows };
      }
    }
    return { rows: [] };
  };
  return { connect: async () => ({ query, release: () => {} }), seen, params };
}

describe('seedDemoTenant (scripted query)', () => {
  it('creates a fresh tenant graph with upserts everywhere', async () => {
    const { connect, seen, params } = scripted({
      'select id from tenant': [],
      'insert into tenant': [{ id: 't-1' }],
      'select id from role': [],
      'insert into role': [{ id: 'r-1' }],
      'select id from app_user': [],
      'insert into app_user': [{ id: 'u-1' }],
      'select id from permission': [{ id: 'p-1' }, { id: 'p-2' }],
    });
    const result = await seedDemoTenant(connect, 'demo-fresh');
    expect(result).toEqual({
      tenantId: 't-1',
      adminUserId: 'u-1',
      adminRoleId: 'r-1',
      created: true,
    });
    const writes = seen.filter((s) => s.startsWith('insert into'));
    expect(writes.length).toBeGreaterThan(0);
    for (const sql of writes) {
      if (sql.startsWith('insert into audit_event')) {
        continue; // append-only by design — no upsert clause
      }
      expect(sql).toMatch(/on conflict/);
    }
    expect(writes.join('\n')).toContain('insert into audit_event');
    expect(params.flat().filter((p) => p === 'tenant.seeded')).toHaveLength(1);
  });

  it('skips the audit write when asked (test graphs stay clean)', async () => {
    const { connect, seen } = scripted({
      'select id from tenant': [],
      'insert into tenant': [{ id: 't-1' }],
      'select id from role': [],
      'insert into role': [{ id: 'r-1' }],
      'select id from app_user': [],
      'insert into app_user': [{ id: 'u-1' }],
      'select id from permission': [{ id: 'p-1' }],
    });
    const result = await seedDemoTenant(connect, 'demo-quiet', { audit: false });
    expect(result.created).toBe(true);
    expect(seen.some((s) => s.includes('audit_event'))).toBe(false);
  });

  it('reuses an existing graph without rewriting it', async () => {
    const { connect, seen } = scripted({
      'select id from tenant': [{ id: 't-9' }],
      'select id from role': [{ id: 'r-9' }],
      'select id from app_user': [{ id: 'u-9' }],
      'select id from permission': [{ id: 'p-9' }],
    });
    const result = await seedDemoTenant(connect, 'demo-existing');
    expect(result).toMatchObject({ tenantId: 't-9', created: false });
    expect(seen.some((s) => s.startsWith('insert into tenant'))).toBe(false);
  });

  it('never references credential storage', async () => {
    const { connect, seen } = scripted({
      'select id from tenant': [{ id: 't-1' }],
      'select id from role': [{ id: 'r-1' }],
      'select id from app_user': [{ id: 'u-1' }],
      'select id from permission': [],
    });
    await seedDemoTenant(connect, 'demo-clean');
    const all = seen.join('\n').toLowerCase();
    expect(all).not.toContain('password');
    expect(all).not.toContain('secret');
    expect(all).not.toContain('token');
    expect(DEMO_PERMISSIONS.length).toBeGreaterThan(0);
  });
});
