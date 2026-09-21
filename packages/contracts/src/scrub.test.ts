import { describe, expect, it } from 'vitest';
import { scrubSecrets } from './scrub.js';

describe('scrubSecrets', () => {
  it('scrubs sensitive keys at any depth, arrays included', () => {
    const out = scrubSecrets({
      user: 'ops',
      password: 'hunter2',
      nested: { apiKey: 'abc', list: [{ token: 't' }, 'fine'] },
    }) as Record<string, unknown>;
    expect(out['user']).toBe('ops');
    expect(out['password']).toBe('[REDACTED]');
    expect((out['nested'] as Record<string, unknown>)['apiKey']).toBe('[REDACTED]');
    expect(((out['nested'] as Record<string, unknown>)['list'] as unknown[])[1]).toBe('fine');
  });

  it('scrubs bearer credentials, database URLs, and assignments in values', () => {
    expect(scrubSecrets('Bearer abc.def.ghi')).toBe('[REDACTED]');
    expect(scrubSecrets('postgresql://user:pw@host:5432/db')).toBe('postgresql://***@host:5432/db');
    expect(scrubSecrets('token=live-secret-abc123')).toBe('token=[REDACTED]');
    expect(scrubSecrets('plain text')).toBe('plain text');
  });

  it('never pollutes the prototype through hostile keys', () => {
    scrubSecrets(JSON.parse('{"__proto__":{"polluted":true},"a":1}'));
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('leaves non-sensitive telemetry untouched', () => {
    expect(scrubSecrets({ tenantId: 't-1', count: 3, ok: true })).toEqual({
      tenantId: 't-1',
      count: 3,
      ok: true,
    });
  });
});
