import { describe, expect, it } from 'vitest';
import { requireTenant } from './index.js';

describe('requireTenant', () => {
  it('passes through a valid tenant', () => {
    expect(requireTenant({ tenantId: 'acme' })).toEqual({ tenantId: 'acme' });
  });

  it('rejects missing, blank, and null contexts', () => {
    expect(() => requireTenant(undefined)).toThrow();
    expect(() => requireTenant(null)).toThrow();
    expect(() => requireTenant({})).toThrow();
    expect(() => requireTenant({ tenantId: '  ' })).toThrow();
  });
});
