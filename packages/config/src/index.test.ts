import { describe, expect, it } from 'vitest';
import { DEFAULT_BLOB_ROOT, loadLocalConfig } from './index.js';

describe('loadLocalConfig', () => {
  it('falls back to ./data/uploads when unset', () => {
    expect(loadLocalConfig({})).toEqual({ localBlobRoot: DEFAULT_BLOB_ROOT });
  });

  it('treats blank as unset', () => {
    expect(loadLocalConfig({ LOCAL_BLOB_ROOT: '   ' })).toEqual({
      localBlobRoot: DEFAULT_BLOB_ROOT,
    });
  });

  it('honours an explicit root', () => {
    expect(loadLocalConfig({ LOCAL_BLOB_ROOT: '/mnt/blobs' })).toEqual({
      localBlobRoot: '/mnt/blobs',
    });
  });
});
