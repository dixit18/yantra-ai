import { describe, expect, it } from 'vitest';
import { redactDatabaseUrl, validateLeanEnv } from './env.js';

const GOOD_ENV = {
  DATABASE_URL: 'postgresql://user:pw@localhost:5432/appdb',
  APP_SECRET: 'local-dev-only-change-me',
};

describe('validateLeanEnv', () => {
  it('accepts a complete lean env and defaults the blob root', () => {
    const env = validateLeanEnv(GOOD_ENV);
    expect(env.DATABASE_URL).toBe(GOOD_ENV.DATABASE_URL);
    expect(env.LOCAL_BLOB_ROOT).toBe('./data/uploads');
    expect(env.MODEL_API_KEY).toBe('');
  });

  it('rejects a missing DATABASE_URL without echoing anything', () => {
    expect(() => validateLeanEnv({ APP_SECRET: GOOD_ENV.APP_SECRET })).toThrow(
      /DATABASE_URL is not set/,
    );
  });

  it('rejects a non-postgres scheme', () => {
    expect(() => validateLeanEnv({ ...GOOD_ENV, DATABASE_URL: 'mysql://u:p@host/db' })).toThrow(
      /postgresql:\/\//,
    );
  });

  it('rejects a short APP_SECRET', () => {
    expect(() => validateLeanEnv({ ...GOOD_ENV, APP_SECRET: 'short' })).toThrow(/APP_SECRET/);
  });

  it('trims a padded APP_SECRET instead of failing it', () => {
    const env = validateLeanEnv({ ...GOOD_ENV, APP_SECRET: '  local-dev-only-change-me  ' });
    expect(env.APP_SECRET).toBe('local-dev-only-change-me');
  });

  it('never leaks credential values inside validation errors', () => {
    const secret = 'SUPERSECRET-no-log';
    const env = {
      DATABASE_URL: `postgresql://user:${secret}@host/db`,
      APP_SECRET: 'x',
    };
    try {
      validateLeanEnv(env);
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
});

describe('redactDatabaseUrl', () => {
  it('keeps scheme, host, and database while dropping credentials', () => {
    expect(redactDatabaseUrl('postgresql://user:pw@db.example.com:5432/appdb')).toBe(
      'postgresql://***@db.example.com:5432/appdb',
    );
  });

  it('degrades safely on unparseable input', () => {
    expect(redactDatabaseUrl('not a url')).toBe('not a url://***@unparseable');
  });
});
