// Live proof on the supplied PostgreSQL + local temp filesystem (skipped
// without DATABASE_URL). Unique tenants per run; everything created is
// removed, so runs never collide and leave no litter.
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import {
  defaultMigrationsDir,
  migrate,
  POSTGRES_POOL_OPTIONS,
  seedDemoTenant,
  type QueryRow,
} from '@yantra/db';
import { LocalFileBlobStore } from './local.js';

describe.skipIf(!process.env['DATABASE_URL'])('blobstore integration (live)', () => {
  it('stores tenant-scoped bytes with dedupe, isolation, and no path escape', async () => {
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
    const root = join(tmpdir(), `yantra-blob-live-${Date.now().toString(36)}`);
    const store = new LocalFileBlobStore(root, query);
    const stamp = Date.now().toString(36);
    const tenantIds: string[] = [];
    try {
      await migrate(connect, defaultMigrationsDir());
      const tenantA = await seedDemoTenant(connect, `demo-blob-a-${stamp}`, { audit: false });
      const tenantB = await seedDemoTenant(connect, `demo-blob-b-${stamp}`, { audit: false });
      tenantIds.push(tenantA.tenantId, tenantB.tenantId);

      const bytes = new TextEncoder().encode('packing-list v3 contents');
      const refA = await store.put(tenantA.tenantId, bytes, {
        filename: 'packing-list.txt',
        mimeType: 'text/plain',
      });
      expect(refA.fileId).toMatch(/^blob_[0-9a-f]{32}$/);
      expect(refA.sizeBytes).toBe(bytes.length);

      // Duplicate binary: same tenant, same bytes → same ref, one row.
      const refA2 = await store.put(tenantA.tenantId, bytes, { filename: 'other-name.txt' });
      expect(refA2.fileId).toBe(refA.fileId);
      const count = await query(
        'select count(*) as n from blob_file where tenant_id = $1 and sha256 = $2',
        [tenantA.tenantId, refA.sha256],
      );
      expect(String(count.rows[0]?.['n'])).toBe('1');

      // Same bytes under another tenant: isolated row, isolated bytes.
      const refB = await store.put(tenantB.tenantId, bytes, { filename: 'packing-list.txt' });
      expect(refB.fileId).not.toBe(refA.fileId);

      // Cross-tenant read: identical error, no oracle.
      await expect(store.get(tenantB.tenantId, refA.fileId)).rejects.toThrow(/^blob not found$/);
      await expect(store.get(tenantA.tenantId, refB.fileId)).rejects.toThrow(/^blob not found$/);

      // Roundtrip preserves bytes and metadata.
      const back = await store.get(tenantA.tenantId, refA.fileId);
      expect(new TextDecoder().decode(back.bytes)).toBe('packing-list v3 contents');
      expect(back.meta.filename).toBe('packing-list.txt');

      // Traversal payloads never reach the filesystem or SQL.
      await expect(store.put('..', bytes, { filename: 'x' })).rejects.toThrow(/invalid tenant/);
      await expect(store.get(tenantA.tenantId, '../../etc/passwd')).rejects.toThrow(
        /invalid file id/,
      );

      // Missing bytes with a live row is an integrity error, not a 404.
      await rm(join(root, tenantB.tenantId), { recursive: true, force: true });
      await expect(store.get(tenantB.tenantId, refB.fileId)).rejects.toThrow(/inconsistent/);
    } finally {
      try {
        if (tenantIds.length > 0) {
          await query('delete from blob_file where tenant_id = any($1)', [tenantIds]);
          await query(
            'delete from user_role where user_id in (select id from app_user where tenant_id = any($1))',
            [tenantIds],
          );
          await query('delete from app_user where tenant_id = any($1)', [tenantIds]);
          await query('delete from role where tenant_id = any($1)', [tenantIds]);
          await query('delete from tenant where id = any($1)', [tenantIds]);
        }
        await rm(root, { recursive: true, force: true });
      } finally {
        await pool.end();
      }
    }
  }, 120_000);
});
