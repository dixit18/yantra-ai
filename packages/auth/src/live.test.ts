// Live adversarial proof (skipped without DATABASE_URL): real tenants, real
// tokens, real denial paths. Uses a throwaway HMAC secret — auth never needs
// the genuine APP_SECRET, and tests must never touch it.
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { defaultMigrationsDir, migrate, POSTGRES_POOL_OPTIONS, seedDemoTenant } from '@yantra/db';
import { authenticateRequest, requirePermission, requireSameTenant } from './permissions.js';
import { issueToken } from './token.js';

const TEST_SECRET = 'live-adversarial-test-secret-min-32-chars';

describe.skipIf(!process.env['DATABASE_URL'])('auth adversarial (live)', () => {
  it('authenticates, authorizes, and denies across tenants', async () => {
    const pool = new Pool({
      connectionString: process.env['DATABASE_URL'] as string,
      ...POSTGRES_POOL_OPTIONS,
    });
    const query = async (sql: string, params?: unknown[]) => ({
      rows: (await pool.query(sql, params)).rows as Record<string, unknown>[],
    });
    const connect = async () => {
      const client = await pool.connect();
      return {
        query: async (sql: string, params?: unknown[]) => ({
          rows: (await client.query(sql, params)).rows as Record<string, unknown>[],
        }),
        release: () => client.release(),
      };
    };
    const stamp = Date.now().toString(36);
    const tenantIds: string[] = [];
    try {
      await migrate(connect, defaultMigrationsDir());
      const tenantA = await seedDemoTenant(connect, `demo-auth-a-${stamp}`, { audit: false });
      const tenantB = await seedDemoTenant(connect, `demo-auth-b-${stamp}`, { audit: false });
      tenantIds.push(tenantA.tenantId, tenantB.tenantId);

      // Authenticated request resolves tenant + permissions from the server.
      const token = issueToken(
        { tenantId: tenantA.tenantId, userId: tenantA.adminUserId },
        TEST_SECRET,
      );
      const ctx = await authenticateRequest(
        { authorization: `Bearer ${token}` },
        { secret: TEST_SECRET, query },
      );
      expect(ctx.tenantId).toBe(tenantA.tenantId);
      expect(ctx.userId).toBe(tenantA.adminUserId);
      expect(ctx.permissions).toEqual(
        expect.arrayContaining([
          'knowledge:approve',
          'service:escalate',
          'parts:request',
          'admin:users',
        ]),
      );

      // Same-tenant action allowed; foreign tenant denied without oracle.
      requireSameTenant(ctx, tenantA.tenantId);
      expect(() => requireSameTenant(ctx, tenantB.tenantId)).toThrow(/cross-tenant/);
      requirePermission(ctx, 'parts:request');
      expect(() => requirePermission(ctx, 'billing:refund')).toThrow(/forbidden/);

      // Adversarial: no header, forged signature, tenant-spoofed token.
      await expect(authenticateRequest({}, { secret: TEST_SECRET, query })).rejects.toThrow(
        /unauthenticated/,
      );
      const forged = `${token.slice(0, -2)}xx`;
      await expect(
        authenticateRequest({ authorization: `Bearer ${forged}` }, { secret: TEST_SECRET, query }),
      ).rejects.toThrow(/unauthenticated/);
      const spoofed = issueToken(
        { tenantId: tenantB.tenantId, userId: tenantA.adminUserId },
        TEST_SECRET,
      );
      await expect(
        authenticateRequest({ authorization: `Bearer ${spoofed}` }, { secret: TEST_SECRET, query }),
      ).rejects.toThrow(/token tenant/);
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
