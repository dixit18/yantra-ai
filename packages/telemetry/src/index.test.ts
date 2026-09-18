import { describe, expect, it } from 'vitest';
import { createCorrelationId } from './index.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('createCorrelationId', () => {
  it('returns a v4 UUID', () => {
    expect(createCorrelationId()).toMatch(UUID_RE);
  });

  it('returns a fresh value on every call', () => {
    expect(createCorrelationId()).not.toBe(createCorrelationId());
  });
});
