import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { QueryFn, QueryRow } from '@yantra/db';
import { assertFileId, assertTenantId, LocalFileBlobStore } from './local.js';

const TENANT = '123e4567-e89b-12d3-a456-426614174000';

function row(overrides: Partial<Record<string, unknown>> = {}): QueryRow {
  return {
    id: 'blob_abcdef0123456789abcdef0123456789',
    tenant_id: TENANT,
    sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    size_bytes: 4,
    mime_type: 'text/plain',
    filename: 'test.txt',
    created_at: new Date('2026-09-18T00:00:00.000Z'),
    ...overrides,
  };
}

async function scratch(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'yantra-blob-'));
  return dir;
}

describe('id validation', () => {
  it('accepts well-formed ids and rejects traversal payloads', () => {
    expect(() => assertTenantId(TENANT)).not.toThrow();
    expect(() => assertFileId('blob_abcdef0123456789abcdef0123456789')).not.toThrow();
    for (const bad of [
      '..',
      '../etc',
      '../../etc/passwd',
      '',
      'blob_',
      'blob_../../x',
      TENANT + '/x',
    ]) {
      expect(() => assertTenantId(bad)).toThrow(/invalid tenant id/);
    }
    for (const bad of ['..', '../../etc/passwd', 'not-a-blob-id', 'blob_', '']) {
      expect(() => assertFileId(bad)).toThrow(/invalid file id/);
    }
  });

  it('rejects empty roots and empty blobs', async () => {
    const query: QueryFn = async () => ({ rows: [] });
    expect(() => new LocalFileBlobStore('   ', query)).toThrow(/root is empty/);
    const store = new LocalFileBlobStore(await scratch(), query);
    await expect(store.put(TENANT, new Uint8Array(), { filename: 'e' })).rejects.toThrow(
      /empty blob/,
    );
  });
});

describe('put/get against scripted registry', () => {
  it('writes content-addressed bytes and reads them back', async () => {
    const root = await scratch();
    const bytes = new TextEncoder().encode('test');
    let stored: QueryRow | null = null;
    const query: QueryFn = async (sql: string, params?: unknown[]) => {
      if (sql.startsWith('select * from blob_file where tenant_id')) {
        return { rows: stored ? [stored] : [] };
      }
      if (sql.startsWith('insert into blob_file')) {
        stored = row({
          id: params?.[0],
          tenant_id: params?.[1],
          sha256: params?.[2],
          size_bytes: params?.[3],
          mime_type: params?.[4],
          filename: params?.[5],
        });
        return { rows: [stored] };
      }
      return { rows: [] };
    };
    const store = new LocalFileBlobStore(root, query);
    const ref = await store.put(TENANT, bytes, {
      filename: '../../evil.txt',
      mimeType: 'text/plain',
    });
    expect(ref.fileId).toMatch(/^blob_[0-9a-f]{32}$/);
    expect(ref.sha256).toBe('9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08');
    // Hostile filename is metadata only: the object path uses the hash.
    const onDisk = await readFile(
      resolve(root, TENANT, ref.sha256.slice(0, 2), ref.sha256),
      'utf8',
    );
    expect(onDisk).toBe('test');
    expect(resolve(root, TENANT)).not.toContain('..');

    const back = await store.get(TENANT, ref.fileId);
    expect(new TextDecoder().decode(back.bytes)).toBe('test');
    expect(back.meta).toEqual(ref);
  });

  it('returns one error for missing and foreign rows alike', async () => {
    const query: QueryFn = async () => ({ rows: [] });
    const store = new LocalFileBlobStore(await scratch(), query);
    await expect(store.get(TENANT, 'blob_abcdef0123456789abcdef0123456789')).rejects.toThrow(
      /^blob not found$/,
    );
    await expect(store.get('..', 'blob_abcdef0123456789abcdef0123456789')).rejects.toThrow(
      /invalid tenant id/,
    );
  });

  it('rejects malformed registry rows instead of serving them', async () => {
    const query: QueryFn = async () => ({ rows: [{ id: 'nope' }] });
    const store = new LocalFileBlobStore(await scratch(), query);
    await expect(store.get(TENANT, 'blob_abcdef0123456789abcdef0123456789')).rejects.toThrow(
      /malformed row/,
    );
  });

  it('coerces node-postgres wire shapes (bigint and timestamptz as strings)', async () => {
    const root = await scratch();
    const sha = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';
    await mkdir(join(root, TENANT, sha.slice(0, 2)), { recursive: true });
    await writeFile(join(root, TENANT, sha.slice(0, 2), sha), 'test');
    const wireRow = {
      id: 'blob_abcdef0123456789abcdef0123456789',
      tenant_id: TENANT,
      sha256: sha,
      size_bytes: '4',
      mime_type: 'text/plain',
      filename: 'wire.txt',
      created_at: '2026-09-18T00:00:00.000Z',
    };
    const query: QueryFn = async () => ({ rows: [{ ...wireRow }] });
    const store = new LocalFileBlobStore(root, query);
    const back = await store.get(TENANT, 'blob_abcdef0123456789abcdef0123456789');
    expect(back.meta.sizeBytes).toBe(4);
    expect(back.meta.createdAt).toBe('2026-09-18T00:00:00.000Z');
  });
});

describe('hardening (critic BLOCKED follow-ups)', () => {
  const SHA_OF_TEST = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';

  it('rejects bytes that fail hash verification on read', async () => {
    const root = await scratch();
    await mkdir(join(root, TENANT, SHA_OF_TEST.slice(0, 2)), { recursive: true });
    await writeFile(join(root, TENANT, SHA_OF_TEST.slice(0, 2), SHA_OF_TEST), 'tampered');
    const query: QueryFn = async () => ({
      rows: [
        {
          id: 'blob_abcdef0123456789abcdef0123456789',
          tenant_id: TENANT,
          sha256: SHA_OF_TEST,
          size_bytes: 4,
          mime_type: 'text/plain',
          filename: 'test.txt',
          created_at: '2026-09-18T00:00:00.000Z',
        },
      ],
    });
    const store = new LocalFileBlobStore(root, query);
    await expect(store.get(TENANT, 'blob_abcdef0123456789abcdef0123456789')).rejects.toThrow(
      /hash mismatch/,
    );
  });

  it('enforces a size cap before hashing', async () => {
    let queried = false;
    const query: QueryFn = async () => {
      queried = true;
      return { rows: [] };
    };
    const store = new LocalFileBlobStore(await scratch(), query, { maxBytes: 10 });
    await expect(store.put(TENANT, new Uint8Array(11), { filename: 'big' })).rejects.toThrow(
      /too large/,
    );
    expect(queried).toBe(false);
  });

  it('sanitizes hostile filenames to metadata-safe values', async () => {
    const root = await scratch();
    const seen: unknown[][] = [];
    const query: QueryFn = async (sql: string, params?: unknown[]) => {
      if (sql.startsWith('select * from blob_file where tenant_id')) {
        return { rows: [] };
      }
      seen.push(params ?? []);
      return {
        rows: [
          {
            id: params?.[0],
            tenant_id: params?.[1],
            sha256: params?.[2],
            size_bytes: params?.[3],
            mime_type: params?.[4],
            filename: params?.[5],
            created_at: new Date(),
          },
        ],
      };
    };
    const store = new LocalFileBlobStore(root, query);
    const ref = await store.put(TENANT, new TextEncoder().encode('x'), {
      filename: `a${String.fromCharCode(0)}b${String.fromCharCode(28)}c${'y'.repeat(300)}`,
    });
    expect(ref.filename).not.toMatch(
      new RegExp(
        `[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}]`,
      ),
    );
    expect(ref.filename.length).toBeLessThanOrEqual(255);
  });

  it('folds tenant case to one directory', async () => {
    const root = await scratch();
    const query: QueryFn = async (sql: string) => {
      if (sql.startsWith('select * from blob_file where tenant_id')) {
        return { rows: [] };
      }
      return {
        rows: [
          {
            id: 'blob_abcdef0123456789abcdef0123456789',
            tenant_id: TENANT,
            sha256: SHA_OF_TEST,
            size_bytes: 4,
            mime_type: 'text/plain',
            filename: 't.txt',
            created_at: new Date(),
          },
        ],
      };
    };
    const store = new LocalFileBlobStore(root, query);
    await store.put(TENANT.toUpperCase(), new TextEncoder().encode('test'), { filename: 't.txt' });
    expect(await readdir(root)).toEqual([TENANT]);
  });
});
