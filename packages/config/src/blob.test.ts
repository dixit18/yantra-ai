import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ensureBlobRoot } from './blob.js';

describe('ensureBlobRoot', () => {
  it('creates nested directories and proves writability', async () => {
    const base = await mkdtemp(join(tmpdir(), 'yantra-blob-'));
    const nested = join(base, 'tenant-a', 'uploads');
    await expect(ensureBlobRoot(nested)).resolves.toBe(nested);
    const probe = join(nested, 'probe.txt');
    await writeFile(probe, 'ok');
    await expect(readFile(probe, 'utf8')).resolves.toBe('ok');
  });

  it('rejects a blank path', async () => {
    await expect(ensureBlobRoot('   ')).rejects.toThrow(/blob root path is empty/);
  });
});
