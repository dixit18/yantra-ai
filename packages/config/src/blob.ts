// P1-ENV-002 — local blob-root guarantee. The full tenant-scoped BlobStore
// (opaque ids, hashes, traversal defense) arrives in P2-OBJ-010; this proves
// the configured directory exists with a real probe write, not just W_OK.
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

export async function ensureBlobRoot(root: string): Promise<string> {
  const trimmed = root.trim();
  if (!trimmed) {
    throw new Error('blob root path is empty (see LOCAL_BLOB_ROOT in .env.example)');
  }
  await fs.mkdir(trimmed, { recursive: true });
  const probe = join(trimmed, `.writetest-${process.pid}-${Date.now()}`);
  await fs.writeFile(probe, 'ok');
  await fs.unlink(probe);
  return trimmed;
}
