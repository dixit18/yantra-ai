import { describe, expect, it } from 'vitest';
import { databaseScheme, readDatabaseUrl } from './index.js';

describe('db env helper', () => {
  it('throws when DATABASE_URL is missing', () => {
    expect(() => readDatabaseUrl({})).toThrow(/DATABASE_URL/);
  });

  it('returns the configured value untouched', () => {
    expect(readDatabaseUrl({ DATABASE_URL: 'postgresql://x' })).toBe('postgresql://x');
  });

  it('reads only the scheme, never credentials', () => {
    expect(databaseScheme('postgresql://user:secret@host/db')).toBe('postgresql');
  });
});
