// Live proof on the supplied PostgreSQL (skipped without DATABASE_URL).
// Litter-free by construction: seeds run with audit:false, the immutability
// probe rolls its transaction back, and the restrict probe uses the permanent
// CLI-seeded `demo` tenant. Unique slugs per run; plain deletes clean up.
// The granted side effect is intended: this IS the database the app runs
// against, so migrations belong here.
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { POSTGRES_POOL_OPTIONS, type QueryRow } from './check.js';
import { defaultMigrationsDir, migrate } from './migrate.js';
import { seedDemoTenant } from './seed.js';

const REQUIRED_TABLES = [
  'tenant',
  'app_user',
  'role',
  'permission',
  'role_permission',
  'user_role',
  'audit_event',
  'schema_migrations',
];

describe.skipIf(!process.env['DATABASE_URL'])('db integration (live)', () => {
  it('migrates, seeds idempotently, and isolates tenants', async () => {
    const pool = new Pool({
      connectionString: process.env['DATABASE_URL'] as string,
      ...POSTGRES_POOL_OPTIONS,
    });
    const query = async (sql: string, params?: unknown[]) => ({
      rows: (await pool.query(sql, params)).rows as QueryRow[],
    });
    const connect = async () => {
      const client = await pool.connect();
      return {
        query: async (sql: string, params?: unknown[]) => ({
          rows: (await client.query(sql, params)).rows as QueryRow[],
        }),
        release: () => client.release(),
      };
    };
    const stamp = Date.now().toString(36);
    const slugA = `demo-test-a-${stamp}`;
    const slugB = `demo-test-b-${stamp}`;
    const tenantIds: string[] = [];
    try {
      await migrate(connect, defaultMigrationsDir());
      const tables = await query("select tablename from pg_tables where schemaname = 'public'");
      const names = tables.rows.map((r) => String(r['tablename']));
      for (const table of REQUIRED_TABLES) {
        expect(names, `missing table ${table}`).toContain(table);
      }

      const first = await seedDemoTenant(connect, slugA, { audit: false });
      const second = await seedDemoTenant(connect, slugA, { audit: false });
      expect(first.created).toBe(true);
      expect(second.created).toBe(false);
      expect(second.tenantId).toBe(first.tenantId);
      expect(second.adminUserId).toBe(first.adminUserId);
      tenantIds.push(first.tenantId);

      const other = await seedDemoTenant(connect, slugB, { audit: false });
      expect(other.tenantId).not.toBe(first.tenantId);
      tenantIds.push(other.tenantId);

      // Isolation probe 1: A's user row is invisible under B's tenant scope.
      const crossRead = await query('select id from app_user where tenant_id = $1 and id = $2', [
        other.tenantId,
        first.adminUserId,
      ]);
      expect(crossRead.rows).toHaveLength(0);

      // Isolation probe 2: the database itself rejects orphaned rows.
      await expect(
        query(
          "insert into app_user (tenant_id, name, email) values ('00000000-0000-0000-0000-000000000000', 'x', 'x@demo.local')",
        ),
      ).rejects.toThrow();

      // Isolation probe 3: the junction rejects a cross-tenant user/role pair.
      await expect(
        query('insert into user_role (user_id, role_id, tenant_id) values ($1, $2, $3)', [
          first.adminUserId,
          other.adminRoleId,
          other.tenantId,
        ]),
      ).rejects.toThrow();

      // Immutability probe: runs in an explicit transaction that always
      // rolls back, so the probe row never persists.
      const probeClient = await pool.connect();
      try {
        await probeClient.query('begin');
        const probe = await probeClient.query(
          "insert into audit_event (tenant_id, type, entity) values ($1, 'probe', 'probe') returning id",
          [first.tenantId],
        );
        const probeId = (probe.rows[0] as QueryRow | undefined)?.['id'];
        // Each rejected statement aborts the transaction, so a savepoint
        // separates the two probes.
        await probeClient.query('savepoint sp_update');
        await expect(
          probeClient.query('update audit_event set type = $1 where id = $2', ['x', probeId]),
        ).rejects.toThrow(/append-only/);
        await probeClient.query('rollback to savepoint sp_update');
        await expect(
          probeClient.query('delete from audit_event where id = $1', [probeId]),
        ).rejects.toThrow(/append-only/);
      } finally {
        await probeClient.query('rollback');
        probeClient.release();
      }

      // Restrict probe: the permanent CLI-seeded demo tenant carries history
      // and cannot vanish through app paths. Needs no new rows.
      const demo = await query("select id from tenant where slug = 'demo'");
      expect(demo.rows.length).toBeGreaterThan(0);
      await expect(
        query('delete from tenant where id = $1', [demo.rows[0]?.['id']]),
      ).rejects.toThrow();
    } finally {
      try {
        if (tenantIds.length > 0) {
          await query(
            'delete from user_role where user_id in (select id from app_user where tenant_id = any($1))',
            [tenantIds],
          );
          await query('delete from app_user where tenant_id = any($1)', [tenantIds]);
          await query('delete from role where tenant_id = any($1)', [tenantIds]);
          await query('delete from tenant where id = any($1)', [tenantIds]);
        }
      } finally {
        await pool.end();
      }
    }
  }, 120_000);
});
