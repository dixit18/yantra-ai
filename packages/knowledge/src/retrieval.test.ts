// Live retrieval proof on pgvector (skipped without DATABASE_URL). Hash
// embeddings carry no semantics, so similarity assertions use exact vectors
// (distance ~0 first) and set membership — the mechanics under test are
// tenant scoping, ordering, re-index replacement, and version exclusion.
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
import { HashEmbedder } from './embeddings.js';
import { indexVersionSegments, searchSimilar } from './segments.js';
import { createDocument, createDocumentVersion } from './documents.js';

describe.skipIf(!process.env['DATABASE_URL'])('retrieval (live pgvector)', () => {
  it('indexes, scopes, re-indexes, and excludes versions', async () => {
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
    const root = await mkdtemp(join(tmpdir(), 'yantra-ret-live-'));
    const store = new LocalFileBlobStore(root, query);
    const embedder = new HashEmbedder();
    const stamp = Date.now().toString(36);
    const tenantIds: string[] = [];
    try {
      await migrate(connect, defaultMigrationsDir());
      const tenantA = await seedDemoTenant(connect, `demo-ret-a-${stamp}`, { audit: false });
      const tenantB = await seedDemoTenant(connect, `demo-ret-b-${stamp}`, { audit: false });
      tenantIds.push(tenantA.tenantId, tenantB.tenantId);

      const textsA = ['seal kit replacement steps', 'torque the housing bolts'];
      const vectorsA = await embedder.embed(textsA);
      const blobA = await store.put(tenantA.tenantId, new TextEncoder().encode('doc a'), {
        filename: 'a.pdf',
      });
      const docA = await createDocument(query, {
        tenantId: tenantA.tenantId,
        sourceType: 'pdf',
        title: 'Doc A',
      });
      const versionA = await createDocumentVersion(query, {
        tenantId: tenantA.tenantId,
        documentId: docA.id,
        versionLabel: 'v1',
        blobFileId: blobA.fileId,
      });
      await indexVersionSegments(connect, {
        tenantId: tenantA.tenantId,
        documentId: docA.id,
        versionId: versionA.id,
        segments: textsA.map((text, i) => ({
          page: 1,
          sectionPath: ['Doc A'],
          kind: 'text',
          text,
          embedding: (vectorsA[i] ?? []) as number[],
        })),
      });

      // Decoy under tenant B with the IDENTICAL embedding.
      const blobB = await store.put(tenantB.tenantId, new TextEncoder().encode('doc b'), {
        filename: 'b.pdf',
      });
      const docB = await createDocument(query, {
        tenantId: tenantB.tenantId,
        sourceType: 'pdf',
        title: 'Doc B',
      });
      const versionB = await createDocumentVersion(query, {
        tenantId: tenantB.tenantId,
        documentId: docB.id,
        versionLabel: 'v1',
        blobFileId: blobB.fileId,
      });
      await indexVersionSegments(connect, {
        tenantId: tenantB.tenantId,
        documentId: docB.id,
        versionId: versionB.id,
        segments: [
          {
            page: 1,
            sectionPath: ['Doc B'],
            kind: 'text',
            text: 'decoy',
            embedding: (vectorsA[0] ?? []) as number[],
          },
        ],
      });

      // Exact vector resolves to the own-tenant segment first, decoy absent.
      const hits = await searchSimilar(query, {
        tenantId: tenantA.tenantId,
        embedding: (vectorsA[0] ?? []) as number[],
        topK: 5,
      });
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0]?.text).toBe('seal kit replacement steps');
      expect(hits[0]?.distance).toBeCloseTo(0);
      expect(hits.every((h) => h.text !== 'decoy')).toBe(true);

      // Unknown tenant sees nothing.
      await expect(
        searchSimilar(query, {
          tenantId: '00000000-0000-0000-0000-000000000000',
          embedding: (vectorsA[0] ?? []) as number[],
          topK: 5,
        }),
      ).resolves.toEqual([]);

      // Re-index replaces: new text searchable, old text gone, count stable.
      const replacement = await embedder.embed(['revised seal procedure']);
      await indexVersionSegments(connect, {
        tenantId: tenantA.tenantId,
        documentId: docA.id,
        versionId: versionA.id,
        segments: [
          {
            page: 2,
            sectionPath: ['Doc A', 'Revised'],
            kind: 'text',
            text: 'revised seal procedure',
            embedding: (replacement[0] ?? []) as number[],
          },
        ],
      });
      const after = await searchSimilar(query, {
        tenantId: tenantA.tenantId,
        embedding: (replacement[0] ?? []) as number[],
        topK: 5,
      });
      expect(after.map((h) => h.text)).toEqual(['revised seal procedure']);

      // Version exclusion drops the superseded version's segments.
      const excluded = await searchSimilar(query, {
        tenantId: tenantA.tenantId,
        embedding: (replacement[0] ?? []) as number[],
        topK: 5,
        excludeVersionIds: [versionA.id],
      });
      expect(excluded).toEqual([]);

      // Guards: wrong dimensions and topK bounds.
      await expect(
        searchSimilar(query, { tenantId: tenantA.tenantId, embedding: [1, 2], topK: 5 }),
      ).rejects.toThrow(/dimensions/);
      await expect(
        searchSimilar(query, {
          tenantId: tenantA.tenantId,
          embedding: (replacement[0] ?? []) as number[],
          topK: 0,
        }),
      ).rejects.toThrow(/topK/);

      // Concurrent re-indexes serialize on the version lock: the final
      // state is exactly one batch, never an interleaved mix.
      const [batchA, batchB] = await Promise.all([
        embedder.embed(['concurrent alpha']),
        embedder.embed(['concurrent beta']),
      ]);
      const batch = (text: string, embedding: number[]) => ({
        page: 1,
        sectionPath: ['A'],
        kind: 'text',
        text,
        embedding,
      });
      await Promise.all([
        indexVersionSegments(connect, {
          tenantId: tenantA.tenantId,
          documentId: docA.id,
          versionId: versionA.id,
          segments: [batch('concurrent alpha', (batchA[0] ?? []) as number[])],
        }),
        indexVersionSegments(connect, {
          tenantId: tenantA.tenantId,
          documentId: docA.id,
          versionId: versionA.id,
          segments: [batch('concurrent beta', (batchB[0] ?? []) as number[])],
        }),
      ]);
      const coherent = await searchSimilar(query, {
        tenantId: tenantA.tenantId,
        embedding: (batchB[0] ?? []) as number[],
        topK: 5,
      });
      expect(coherent).toHaveLength(1);
      expect(['concurrent alpha', 'concurrent beta']).toContain(coherent[0]?.text);
    } finally {
      try {
        if (tenantIds.length > 0) {
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
  }, 180_000);
});
