import { describe, expect, it } from 'vitest';
import type { QueryRow } from '@yantra/db';
import type { MigrationConn } from '@yantra/db';
import { indexVersionSegments, searchSimilar } from './segments.js';
import { EMBEDDING_DIMENSIONS } from './embeddings.js';

const VECTOR = new Array<number>(EMBEDDING_DIMENSIONS).fill(0.1);
const SEGMENT = { page: 1, sectionPath: ['A'], kind: 'text', text: 't', embedding: VECTOR };

function connFor(pairing: QueryRow[]): { connect: () => Promise<MigrationConn>; log: string[] } {
  const log: string[] = [];
  return {
    log,
    connect: async () => ({
      query: async (sql: string) => {
        log.push(sql);
        if (sql.includes('from document_version where id')) {
          return { rows: pairing };
        }
        if (sql.startsWith('insert into document_segment')) {
          return { rows: [{ id: 'seg-1' }] };
        }
        return { rows: [] };
      },
      release: () => {},
    }),
  };
}

describe('indexVersionSegments guards', () => {
  it('serializes per version and verifies the document pairing', async () => {
    const { connect, log } = connFor([{ id: 'v-1' }]);
    await expect(
      indexVersionSegments(connect, {
        tenantId: 't-1',
        documentId: 'd-1',
        versionId: 'v-1',
        segments: [SEGMENT],
      }),
    ).resolves.toEqual(['seg-1']);
    expect(log.some((s) => s.includes('pg_advisory_xact_lock'))).toBe(true);
    expect(log.some((s) => s.includes('from document_version where id'))).toBe(true);
  });

  it('rejects versions outside the given document and tenant', async () => {
    const { connect, log } = connFor([]);
    await expect(
      indexVersionSegments(connect, {
        tenantId: 't-1',
        documentId: 'd-1',
        versionId: 'v-9',
        segments: [SEGMENT],
      }),
    ).rejects.toThrow(/does not belong/);
    expect(log.some((s) => s.startsWith('insert into document_segment'))).toBe(false);
  });
});

describe('searchSimilar guards', () => {
  it('rejects malformed version ids before touching the database', async () => {
    let queried = false;
    const query = async () => {
      queried = true;
      return { rows: [] };
    };
    await expect(
      searchSimilar(query, {
        tenantId: 't-1',
        embedding: VECTOR,
        topK: 5,
        excludeVersionIds: ['nope'],
      }),
    ).rejects.toThrow(/invalid version id/);
    expect(queried).toBe(false);
  });
});
