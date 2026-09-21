// Live document lifecycle on the supplied PostgreSQL (skipped without
// DATABASE_URL). Unique tenant per run; tenant-cascade deletion plus temp-dir
// removal leave no litter.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { LocalFileBlobStore } from '@yantra/blobstore';
import {
  defaultMigrationsDir,
  migrate,
  POSTGRES_POOL_OPTIONS,
  seedDemoTenant,
  type QueryRow,
} from '@yantra/db';
import {
  createDocument,
  createDocumentVersion,
  replaceVersion,
  transitionVersion,
} from './documents.js';

describe.skipIf(!process.env['DATABASE_URL'])('documents lifecycle (live)', () => {
  it('versions walk the state machine and supersede without losing history', async () => {
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
    const root = await mkdtemp(join(tmpdir(), 'yantra-doc-live-'));
    const store = new LocalFileBlobStore(root, query);
    const stamp = Date.now().toString(36);
    const tenantIds: string[] = [];
    try {
      await migrate(connect, defaultMigrationsDir());
      const tenant = await seedDemoTenant(connect, `demo-doc-${stamp}`, { audit: false });
      tenantIds.push(tenant.tenantId);
      const tenantB = await seedDemoTenant(connect, `demo-doc-b-${stamp}`, { audit: false });
      tenantIds.push(tenantB.tenantId);
      const blobB = await store.put(tenantB.tenantId, new TextEncoder().encode('other bytes'), {
        filename: 'other.pdf',
      });

      const bytes = new TextEncoder().encode('pump manual contents');
      const blob = await store.put(tenant.tenantId, bytes, { filename: 'manual.pdf' });
      const doc = await createDocument(query, {
        tenantId: tenant.tenantId,
        sourceType: 'pdf',
        title: 'Pump Manual',
      });
      const v1 = await createDocumentVersion(query, {
        tenantId: tenant.tenantId,
        documentId: doc.id,
        versionLabel: 'v1',
        blobFileId: blob.fileId,
        createdBy: tenant.adminUserId,
      });

      // Illegal jump rejected before any write.
      await expect(
        transitionVersion(query, { tenantId: tenant.tenantId, versionId: v1.id, to: 'approved' }),
      ).rejects.toThrow(/illegal version transition/);

      // Direct-SQL bypasses rejected by the trigger, not just the code
      // (v1 is still a draft here, so both jumps are illegal).
      await expect(
        query("update document_version set approval_state = 'approved' where id = $1", [v1.id]),
      ).rejects.toThrow(/illegal version transition/);
      await expect(
        query('update document_version set version_label = $1 where id = $2', ['hacked', v1.id]),
      ).rejects.toThrow(/immutable/);

      await transitionVersion(query, {
        tenantId: tenant.tenantId,
        versionId: v1.id,
        to: 'in_review',
      });
      await transitionVersion(query, {
        tenantId: tenant.tenantId,
        versionId: v1.id,
        to: 'approved',
      });

      const blob2 = await store.put(tenant.tenantId, new TextEncoder().encode('pump manual rev2'), {
        filename: 'manual-rev2.pdf',
      });
      const v2 = await createDocumentVersion(query, {
        tenantId: tenant.tenantId,
        documentId: doc.id,
        versionLabel: 'v2',
        blobFileId: blob2.fileId,
        createdBy: tenant.adminUserId,
      });
      await transitionVersion(query, {
        tenantId: tenant.tenantId,
        versionId: v2.id,
        to: 'in_review',
      });
      await transitionVersion(query, {
        tenantId: tenant.tenantId,
        versionId: v2.id,
        to: 'approved',
      });

      // Cross-tenant version access denied.
      await expect(
        transitionVersion(query, {
          tenantId: '00000000-0000-0000-0000-000000000000',
          versionId: v1.id,
          to: 'archived',
        }),
      ).rejects.toThrow(/not found/);

      // Cross-tenant blob pointer rejected by the composite FK.
      await expect(
        createDocumentVersion(query, {
          tenantId: tenant.tenantId,
          documentId: doc.id,
          versionLabel: 'vx',
          blobFileId: blobB.fileId,
        }),
      ).rejects.toThrow();

      await replaceVersion(connect, {
        tenantId: tenant.tenantId,
        oldVersionId: v1.id,
        newVersionId: v2.id,
      });
      const states = await query(
        'select id, approval_state, supersedes_version_id, effective_to from document_version where document_id = $1 order by created_at',
        [doc.id],
      );
      expect(states.rows.map((r) => r['approval_state'])).toEqual(['superseded', 'approved']);
      expect(states.rows[1]?.['supersedes_version_id']).toBe(v1.id);
      expect(states.rows[0]?.['effective_to']).not.toBeNull();
    } finally {
      try {
        if (tenantIds.length > 0) {
          // Order matters: versions pin their blobs via RESTRICT, so
          // versions and documents go before the tenant cascade can touch
          // blob_file rows.
          await query(
            `delete from document_version where document_id in
               (select id from document where tenant_id = any($1))`,
            [tenantIds],
          );
          await query('delete from document where tenant_id = any($1)', [tenantIds]);
          await query('delete from tenant where id = any($1)', [tenantIds]);
        }
        await rm(root, { recursive: true, force: true });
      } finally {
        await pool.end();
      }
    }
  }, 120_000);
});
