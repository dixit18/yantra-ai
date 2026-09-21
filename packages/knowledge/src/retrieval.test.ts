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
import {
  createDocument,
  createDocumentVersion,
  replaceVersion,
  transitionVersion,
} from './documents.js';
import { hybridSearch } from './retrieval.js';

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

  it('answers golden queries with exact tokens, scopes, and traces', async () => {
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
    const root = await mkdtemp(join(tmpdir(), 'yantra-hyb-live-'));
    const store = new LocalFileBlobStore(root, query);
    const embedder = new HashEmbedder();
    const stamp = Date.now().toString(36);
    const tenantIds: string[] = [];
    try {
      await migrate(connect, defaultMigrationsDir());
      const tenant = await seedDemoTenant(connect, `demo-hyb-${stamp}`, { audit: false });
      const other = await seedDemoTenant(connect, `demo-hyb-b-${stamp}`, { audit: false });
      tenantIds.push(tenant.tenantId, other.tenantId);

      const putDoc = async (text: string, label: string) => {
        const blob = await store.put(tenant.tenantId, new TextEncoder().encode(text), {
          filename: `${label}.pdf`,
        });
        const doc = await createDocument(query, {
          tenantId: tenant.tenantId,
          sourceType: 'pdf',
          title: label,
        });
        return { doc, blob };
      };
      const oldText = 'obsolete seal procedure, do not follow';
      const newText = 'SEAL-204 torque 45Nm in three passes';
      const { doc } = await putDoc(newText, 'Torque Guide');
      const blobOld = await store.put(tenant.tenantId, new TextEncoder().encode(oldText), {
        filename: 'old.pdf',
      });
      const vOld = await createDocumentVersion(query, {
        tenantId: tenant.tenantId,
        documentId: doc.id,
        versionLabel: 'v1',
        blobFileId: blobOld.fileId,
      });
      const vNew = await createDocumentVersion(query, {
        tenantId: tenant.tenantId,
        documentId: doc.id,
        versionLabel: 'v2',
        blobFileId: (
          await store.put(tenant.tenantId, new TextEncoder().encode(newText), {
            filename: 'new.pdf',
          })
        ).fileId,
      });
      for (const v of [vOld, vNew]) {
        await transitionVersion(query, {
          tenantId: tenant.tenantId,
          versionId: v.id,
          to: 'in_review',
        });
        await transitionVersion(query, {
          tenantId: tenant.tenantId,
          versionId: v.id,
          to: 'approved',
        });
      }
      const [oldVec, newVec] = await embedder.embed([oldText, newText]);
      await indexVersionSegments(connect, {
        tenantId: tenant.tenantId,
        documentId: doc.id,
        versionId: vOld.id,
        segments: [
          { page: 1, sectionPath: ['Old'], kind: 'text', text: oldText, embedding: oldVec ?? [] },
        ],
      });
      await indexVersionSegments(connect, {
        tenantId: tenant.tenantId,
        documentId: doc.id,
        versionId: vNew.id,
        segments: [
          {
            page: 1,
            sectionPath: ['Torque'],
            kind: 'text',
            text: newText,
            embedding: newVec ?? [],
          },
        ],
      });
      await replaceVersion(connect, {
        tenantId: tenant.tenantId,
        oldVersionId: vOld.id,
        newVersionId: vNew.id,
      });

      // Golden 1: exact part number resolves with evidence first.
      const exact = await hybridSearch(query, {
        tenantId: tenant.tenantId,
        queryText: 'What torque for SEAL-204?',
        embedder,
      });
      expect(exact.tokens).toContain('SEAL-204');
      expect(exact.hits[0]?.text).toContain('SEAL-204');
      expect(['exact', 'both']).toContain(exact.hits[0]?.origin);
      const trace = await query('select * from retrieval_event where id = $1', [exact.traceId]);
      expect(trace.rows).toHaveLength(1);
      expect(trace.rows[0]?.['query_text']).toContain('SEAL-204');
      expect(trace.rows[0]?.['normalized_tokens']).toContain('SEAL-204');

      // Golden 2: superseded content stays out unless explicitly included.
      const hidden = await hybridSearch(query, {
        tenantId: tenant.tenantId,
        queryText: 'obsolete seal procedure, do not follow',
        embedder,
      });
      expect(hidden.hits.map((h) => h.text)).not.toContain(oldText);
      const shown = await hybridSearch(query, {
        tenantId: tenant.tenantId,
        queryText: 'obsolete seal procedure, do not follow',
        embedder,
        includeSuperseded: true,
      });
      expect(shown.hits.map((h) => h.text)).toContain(oldText);

      // Golden 3: version allowlists scope; foreign scopes are rejected.
      const scoped = await hybridSearch(query, {
        tenantId: tenant.tenantId,
        queryText: 'SEAL-204',
        embedder,
        versionIds: [vNew.id],
      });
      expect(scoped.hits.every((h) => h.versionId === vNew.id)).toBe(true);
      await expect(
        hybridSearch(query, {
          tenantId: other.tenantId,
          queryText: 'SEAL-204',
          embedder,
          versionIds: [vNew.id],
        }),
      ).rejects.toThrow(/outside the tenant/);

      // Golden 4: another tenant sees none of this.
      const foreign = await hybridSearch(query, {
        tenantId: other.tenantId,
        queryText: 'What torque for SEAL-204?',
        embedder,
      });
      expect(foreign.hits).toEqual([]);
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
