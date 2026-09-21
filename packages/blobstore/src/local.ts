// P2-OBJ-010 — local persistent-filesystem BlobStore. Layout:
//   <root>/<tenantId>/<sha256[0:2]>/<sha256>
// Paths derive ONLY from validated ids and the content hash — never from user
// filenames. Writes are file-first (an orphaned file is invisible and
// content-addressed); rows are never orphaned.
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { QueryFn, QueryRow } from '@yantra/db';
import type { BlobBytes, BlobRef, BlobStore, PutOptions } from './store.js';

const FILE_ID_RE = /^blob_[0-9a-f]{32}$/;
const TENANT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA_RE = /^[0-9a-f]{64}$/;
const MIME_RE = /^[-\w.]+\/[-\w.+]+$/;
// Built from char codes: literal control escapes trip no-control-regex,
// even inside RegExp string arguments.
const CONTROL_CHARS_RE = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}]`,
  'g',
);

export function assertTenantId(tenantId: string): void {
  if (!TENANT_ID_RE.test(tenantId)) {
    throw new Error('invalid tenant id');
  }
}

export function assertFileId(fileId: string): void {
  if (!FILE_ID_RE.test(fileId)) {
    throw new Error('invalid file id');
  }
}

function normalizeMimeType(mimeType: string | undefined): string {
  const cleaned = (mimeType ?? '').trim().toLowerCase();
  return MIME_RE.test(cleaned) ? cleaned : 'application/octet-stream';
}

function rowToRef(row: QueryRow): BlobRef {
  const fileId = row['id'];
  const tenantId = row['tenant_id'];
  const sha256 = row['sha256'];
  const sizeRaw = row['size_bytes'];
  const mimeType = row['mime_type'];
  const filename = row['filename'];
  const createdRaw = row['created_at'];
  // node-postgres returns int8 as string and timestamptz as string: coerce,
  // then validate. Anything else is a malformed row, never served.
  const sizeBytes = typeof sizeRaw === 'number' ? sizeRaw : Number(sizeRaw);
  const createdAt = createdRaw instanceof Date ? createdRaw : new Date(String(createdRaw ?? ''));
  if (
    typeof fileId !== 'string' ||
    typeof tenantId !== 'string' ||
    typeof sha256 !== 'string' ||
    !Number.isSafeInteger(sizeBytes) ||
    sizeBytes < 0 ||
    typeof mimeType !== 'string' ||
    typeof filename !== 'string' ||
    Number.isNaN(createdAt.getTime()) ||
    !FILE_ID_RE.test(fileId) ||
    !SHA_RE.test(sha256)
  ) {
    throw new Error('blob registry returned a malformed row');
  }
  return {
    fileId,
    tenantId,
    sha256,
    sizeBytes,
    mimeType,
    filename,
    createdAt: createdAt.toISOString(),
  };
}

export interface LocalStoreOptions {
  maxBytes?: number;
}

export const DEFAULT_MAX_BLOB_BYTES = 10 * 1024 * 1024;

export class LocalFileBlobStore implements BlobStore {
  private readonly root: string;
  private readonly query: QueryFn;
  private readonly maxBytes: number;

  constructor(root: string, query: QueryFn, options: LocalStoreOptions = {}) {
    const trimmed = root.trim();
    if (!trimmed) {
      throw new Error('blob store root is empty');
    }
    this.root = trimmed;
    this.query = query;
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_BLOB_BYTES;
  }

  private dirFor(tenantId: string, sha256: string): string {
    return join(this.root, tenantId.toLowerCase(), sha256.slice(0, 2));
  }

  private objectPath(tenantId: string, sha256: string): string {
    return join(this.dirFor(tenantId, sha256), sha256);
  }

  async put(tenantId: string, bytes: Uint8Array, options: PutOptions): Promise<BlobRef> {
    assertTenantId(tenantId);
    if (bytes.length === 0) {
      throw new Error('cannot store an empty blob');
    }
    if (bytes.length > this.maxBytes) {
      throw new Error(`blob too large: ${bytes.length} bytes exceeds ${this.maxBytes}`);
    }
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    // Filenames are metadata only — strip controls (NUL aborts the Postgres
    // text protocol), trim, and cap length before they reach SQL or logs.
    const filename =
      options.filename.replace(CONTROL_CHARS_RE, '').trim().slice(0, 255) || 'unnamed';
    const mimeType = normalizeMimeType(options.mimeType);

    const existing = await this.query(
      'select * from blob_file where tenant_id = $1 and sha256 = $2',
      [tenantId, sha256],
    );
    if (existing.rows[0]) {
      return rowToRef(existing.rows[0]);
    }

    const fileId = `blob_${randomUUID().replace(/-/g, '')}`;
    const path = this.objectPath(tenantId, sha256);
    await mkdir(this.dirFor(tenantId, sha256), { recursive: true });
    try {
      await writeFile(path, bytes, { flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
      // Same bytes already on disk (concurrent duplicate) — content matches
      // by hash, so sharing the object is safe.
    }
    const inserted = await this.query(
      `insert into blob_file (id, tenant_id, sha256, size_bytes, mime_type, filename)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (tenant_id, sha256) do nothing
         returning *`,
      [fileId, tenantId, sha256, bytes.length, mimeType, filename],
    );
    if (inserted.rows[0]) {
      return rowToRef(inserted.rows[0]);
    }
    const raced = await this.query('select * from blob_file where tenant_id = $1 and sha256 = $2', [
      tenantId,
      sha256,
    ]);
    if (!raced.rows[0]) {
      throw new Error('blob registry lost a concurrent duplicate');
    }
    return rowToRef(raced.rows[0]);
  }

  async get(tenantId: string, fileId: string): Promise<BlobBytes> {
    assertTenantId(tenantId);
    assertFileId(fileId);
    const found = await this.query('select * from blob_file where tenant_id = $1 and id = $2', [
      tenantId,
      fileId,
    ]);
    const row = found.rows[0];
    if (!row) {
      // Same error for missing and foreign rows: no existence oracle.
      throw new Error('blob not found');
    }
    const meta = rowToRef(row);
    let bytes: Uint8Array;
    try {
      bytes = await readFile(this.objectPath(tenantId, meta.sha256));
    } catch {
      throw new Error('blob storage inconsistent: registry row without bytes');
    }
    // Never trust the registry blindly: bit-rot or a swapped object must
    // fail here, not flow into answers, quotes, or procedures.
    const actual = createHash('sha256').update(bytes).digest('hex');
    if (actual !== meta.sha256 || bytes.length !== meta.sizeBytes) {
      throw new Error('blob storage inconsistent: hash mismatch');
    }
    return { bytes, meta };
  }
}

export function createLocalBlobStore(
  root: string,
  query: QueryFn,
  options?: LocalStoreOptions,
): BlobStore {
  return new LocalFileBlobStore(root, query, options);
}
