import { describe, expect, it } from 'vitest';
import type { QueryRow } from '@yantra/db';
import { HashEmbedder } from './embeddings.js';
import { extractTokens, hybridSearch } from './retrieval.js';

describe('extractTokens', () => {
  it('finds part-like codes and normalizes them', () => {
    expect(extractTokens('What torque for seal-204 on PH_200?')).toEqual(['SEAL-204', 'PH_200']);
    expect(extractTokens('Bearing 6204/ZZ and drive 6ES7.321 fit?')).toEqual([
      '6204/ZZ',
      '6ES7.321',
    ]);
    expect(extractTokens('how are you today')).toEqual([]);
    expect(extractTokens('SEAL-204 vs seal-204')).toEqual(['SEAL-204']);
  });
});

function exactRow(id: string, text: string, versionId = 'v-1'): QueryRow {
  return {
    id,
    document_id: 'd-1',
    document_version_id: versionId,
    page: 1,
    section_path: ['A'],
    kind: 'text',
    text_content: text,
  };
}

describe('hybridSearch merge', () => {
  it('ranks exact above vector and merges duplicates as both', async () => {
    const seen: string[] = [];
    const query = async (sql: string) => {
      seen.push(sql);
      if (sql.includes('from document_version where tenant_id')) {
        return { rows: [] };
      }
      if (sql.includes('position(')) {
        return { rows: [exactRow('a', 'seal steps'), exactRow('d', 'seal only')] };
      }
      if (sql.includes('<=>')) {
        return {
          rows: [
            {
              id: 'a',
              document_id: 'd-1',
              document_version_id: 'v-1',
              page: 1,
              section_path: ['A'],
              kind: 'text',
              text_content: 'seal steps',
              distance: 0.5,
            },
            {
              id: 'b',
              document_id: 'd-1',
              document_version_id: 'v-1',
              page: 2,
              section_path: ['A'],
              kind: 'text',
              text_content: 'other',
              distance: 0.1,
            },
          ],
        };
      }
      if (sql.startsWith('insert into retrieval_event')) {
        return { rows: [{ id: 'trace-1' }] };
      }
      return { rows: [] };
    };
    const result = await hybridSearch(query, {
      tenantId: 't-1',
      queryText: 'seal-204 steps',
      embedder: new HashEmbedder(),
    });
    expect(result.hits.map((h) => [h.id, h.origin])).toEqual([
      ['a', 'both'],
      ['d', 'exact'],
      ['b', 'vector'],
    ]);
    expect(result.traceId).toBe('trace-1');
    expect(result.tokens).toEqual(['SEAL-204']);
    expect(seen.some((s) => s.includes('insert into retrieval_event'))).toBe(true);
    // Substring matching needs no LIKE/ESCAPE machinery at all.
    expect(seen.some((s) => s.includes('ilike') || s.includes('escape'))).toBe(false);
    expect(seen.some((s) => s.includes('position('))).toBe(true);
  });

  it('rejects foreign version scopes and bad paging', async () => {
    const query = async (sql: string) => {
      if (sql.includes('from document_version where tenant_id')) {
        return { rows: [] };
      }
      return { rows: [] };
    };
    await expect(
      hybridSearch(query, {
        tenantId: 't-1',
        queryText: 'x',
        embedder: new HashEmbedder(8),
        versionIds: ['11111111-1111-1111-1111-111111111111'],
      }),
    ).rejects.toThrow(/outside the tenant/);
    await expect(
      hybridSearch(query, {
        tenantId: 't-1',
        queryText: 'x',
        embedder: new HashEmbedder(8),
        topK: 0,
      }),
    ).rejects.toThrow(/topK/);
  });
});
