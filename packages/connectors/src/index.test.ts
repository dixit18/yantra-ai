import { describe, expect, it } from 'vitest';
import { isValidIdempotencyKey } from './index.js';

describe('isValidIdempotencyKey', () => {
  it('accepts UUIDs with surrounding whitespace', () => {
    expect(isValidIdempotencyKey('  550e8400-e29b-41d4-a716-446655440000  ')).toBe(true);
  });

  it('rejects empty and malformed keys', () => {
    expect(isValidIdempotencyKey('')).toBe(false);
    expect(isValidIdempotencyKey('not-a-key')).toBe(false);
    expect(isValidIdempotencyKey('550e8400-e29b-41d4-a716')).toBe(false);
  });
});
