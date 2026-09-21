import { describe, expect, it } from 'vitest';
import { issueToken, verifyToken } from './token.js';

const SECRET = 'test-secret-min-32-chars-01234567';
const IDS = { tenantId: 'tenant-1', userId: 'user-1' };
const NOW = 1_800_000_000;

describe('request tokens', () => {
  it('round-trips a signed payload', () => {
    const token = issueToken(IDS, SECRET, NOW);
    expect(token.startsWith('y1.')).toBe(true);
    expect(verifyToken(token, SECRET, NOW + 60)).toEqual({
      tenantId: 'tenant-1',
      userId: 'user-1',
      issuedAt: NOW,
      expiresAt: NOW + 12 * 60 * 60,
    });
  });

  it('rejects tampered bodies without leaking the secret', () => {
    const [prefix, body, sig] = issueToken(IDS, SECRET, NOW).split('.');
    const forged = `${prefix}.${body}X.${sig}`;
    expect(() => verifyToken(forged, SECRET, NOW)).toThrow(/bad token signature/);
  });

  it('rejects a wrong secret, expiry, and malformed shapes', () => {
    const token = issueToken(IDS, SECRET, NOW);
    expect(() => verifyToken(token, 'wrong-secret-00000000000000000000', NOW)).toThrow(
      /bad token signature/,
    );
    expect(() => verifyToken(token, SECRET, NOW + 12 * 60 * 60 + 1)).toThrow(/expired/);
    for (const bad of ['', 'y1.', 'y1.a.b.c', 'other.a.b', 'y1.!!!.???']) {
      expect(() => verifyToken(bad, SECRET, NOW)).toThrow(/unauthenticated/);
    }
  });

  it('requires a 32+ character secret to issue or verify', () => {
    expect(() => issueToken(IDS, '', NOW)).toThrow(/at least 32 characters/);
    expect(() => issueToken(IDS, 'too-short', NOW)).toThrow(/at least 32 characters/);
    expect(() => verifyToken(issueToken(IDS, SECRET, NOW), '', NOW)).toThrow(
      /at least 32 characters/,
    );
  });

  it('bounds ids and ttl at mint time', () => {
    expect(() => issueToken({ tenantId: '', userId: 'u' }, SECRET, NOW)).toThrow(
      /must not be empty/,
    );
    expect(() => issueToken({ tenantId: '   ', userId: 'u' }, SECRET, NOW)).toThrow(
      /must not be empty/,
    );
    expect(() => issueToken({ tenantId: 't', userId: '' }, SECRET, NOW)).toThrow(
      /must not be empty/,
    );
    for (const ttl of [0, -60, Number.NaN, Number.POSITIVE_INFINITY, 86_401]) {
      expect(() => issueToken(IDS, SECRET, NOW, ttl)).toThrow(/between 1 and 86400/);
    }
    expect(() => issueToken(IDS, SECRET, NOW, 86_400)).not.toThrow();
  });
});
