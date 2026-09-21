import { describe, expect, it } from 'vitest';
import type { QueryRow } from '@yantra/db';
import {
  authenticateRequest,
  loadRequestIdentity,
  requirePermission,
  requireSameTenant,
  type RequestContext,
} from './permissions.js';
import { issueToken } from './token.js';

const SECRET = 'test-secret-min-32-chars-01234567';
const CTX: RequestContext = {
  tenantId: 'tenant-1',
  userId: 'user-1',
  permissions: ['knowledge:approve'],
};

function fakeQuery(rows: QueryRow[]) {
  return async () => ({ rows });
}

describe('loadRequestIdentity', () => {
  it('loads tenant and deduped permission codes', async () => {
    const identity = await loadRequestIdentity(
      fakeQuery([
        { tenant_id: 't-1', code: 'a' },
        { tenant_id: 't-1', code: 'a' },
        { tenant_id: 't-1', code: 'b' },
        { tenant_id: 't-1', code: null },
      ]),
      'u-1',
    );
    expect(identity).toEqual({ tenantId: 't-1', permissions: ['a', 'b'] });
  });

  it('rejects unknown users', async () => {
    await expect(loadRequestIdentity(fakeQuery([]), 'ghost')).rejects.toThrow(/unknown user/);
  });
});

describe('guards', () => {
  it('passes held permissions and same-tenant resources', () => {
    expect(() => requirePermission(CTX, 'knowledge:approve')).not.toThrow();
    expect(() => requireSameTenant(CTX, 'tenant-1')).not.toThrow();
  });

  it('denies missing permissions, foreign tenants, and blank scopes', () => {
    expect(() => requirePermission(CTX, 'admin:users')).toThrow(/forbidden/);
    expect(() => requireSameTenant(CTX, 'tenant-2')).toThrow(/cross-tenant/);
    expect(() => requireSameTenant(CTX, '')).toThrow(/cross-tenant/);
  });
});

describe('authenticateRequest', () => {
  const identity = [{ tenant_id: 'tenant-1', code: 'knowledge:approve' }];

  it('builds context from a valid bearer token', async () => {
    const token = issueToken({ tenantId: 'tenant-1', userId: 'user-1' }, SECRET);
    const ctx = await authenticateRequest(
      { authorization: `Bearer ${token}` },
      { secret: SECRET, query: fakeQuery(identity) },
    );
    expect(ctx).toEqual({
      tenantId: 'tenant-1',
      userId: 'user-1',
      permissions: ['knowledge:approve'],
    });
  });

  it('denies missing, malformed, and foreign tokens', async () => {
    await expect(
      authenticateRequest({}, { secret: SECRET, query: fakeQuery(identity) }),
    ).rejects.toThrow(/unauthenticated/);
    await expect(
      authenticateRequest(
        { authorization: 'Basic abc' },
        { secret: SECRET, query: fakeQuery(identity) },
      ),
    ).rejects.toThrow(/unauthenticated/);
    await expect(
      authenticateRequest(
        { authorization: 'Bearer garbage' },
        { secret: SECRET, query: fakeQuery(identity) },
      ),
    ).rejects.toThrow(/unauthenticated/);
  });

  it('denies a token whose tenant does not match the user row', async () => {
    const token = issueToken({ tenantId: 'tenant-2', userId: 'user-1' }, SECRET);
    await expect(
      authenticateRequest(
        { authorization: `Bearer ${token}` },
        { secret: SECRET, query: fakeQuery(identity) },
      ),
    ).rejects.toThrow(/token tenant/);
  });
});
