import { describe, expect, it } from 'vitest';
import { EnvNameSchema, HealthStatusSchema, createHealthStatus } from './index.js';

describe('contracts', () => {
  it('builds a valid health payload', () => {
    expect(createHealthStatus('0.1.0')).toEqual({ status: 'ok', version: '0.1.0' });
  });

  it('rejects an empty version', () => {
    expect(() => createHealthStatus('')).toThrow();
  });

  it('rejects a non-ok status', () => {
    expect(() => HealthStatusSchema.parse({ status: 'fine', version: '0.1.0' })).toThrow();
  });

  it('accepts known env names only', () => {
    expect(EnvNameSchema.parse('DATABASE_URL')).toBe('DATABASE_URL');
    expect(() => EnvNameSchema.parse('GITHUB_TOKEN')).toThrow();
  });
});
