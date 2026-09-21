// P2-OBJ-010 — BlobStore contract. Knowledge logic depends on this interface,
// never on a filesystem path: swapping LocalFileBlobStore for object storage
// later (Scale-Later trigger) changes the implementation, not the callers.
// - uploads are referenced by opaque tenant-scoped file ids (`blob_…`);
// - content hash + metadata live in PostgreSQL; bytes are content-addressed;
// - filesystem paths are never exposed; user filenames are metadata only.
export interface BlobRef {
  fileId: string;
  tenantId: string;
  sha256: string;
  sizeBytes: number;
  mimeType: string;
  filename: string;
  createdAt: string;
}

export interface BlobBytes {
  bytes: Uint8Array;
  meta: BlobRef;
}

export interface PutOptions {
  filename: string;
  mimeType?: string;
}

export interface BlobStore {
  put(tenantId: string, bytes: Uint8Array, options: PutOptions): Promise<BlobRef>;
  get(tenantId: string, fileId: string): Promise<BlobBytes>;
}
