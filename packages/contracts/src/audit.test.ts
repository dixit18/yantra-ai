import { describe, expect, it } from 'vitest';
import { AUDIT_EVENT_TYPES, buildAuditInsert } from './audit.js';

describe('buildAuditInsert', () => {
  it('builds a parameterized insert for a listed type', () => {
    const insert = buildAuditInsert({
      type: 'case.opened',
      entity: 'service_case',
      entityId: 'c-1',
    });
    expect(insert.sql).toContain('insert into audit_event');
    expect(insert.params[2]).toBe('case.opened');
    expect(AUDIT_EVENT_TYPES).toContain('tenant.seeded');
  });

  it('scrubs secrets from the immutable payload', () => {
    const insert = buildAuditInsert({
      type: 'case.opened',
      entity: 'service_case',
      data: { password: 'hunter2', nested: { apiKey: 'k', auth: 'Bearer abc' } },
    });
    expect(insert.params[5]).not.toContain('hunter2');
    expect(insert.params[5]).not.toContain('Bearer abc');
    expect(insert.params[5]).toContain('[REDACTED]');
  });

  it('rejects unlisted types, blank entities, and oversize payloads', () => {
    expect(() => buildAuditInsert({ type: 'nope.unknown' as never, entity: 'e' })).toThrow(
      /not allowlisted/,
    );
    expect(() => buildAuditInsert({ type: 'case.opened', entity: '  ' })).toThrow(
      /type and an entity/,
    );
    expect(() =>
      buildAuditInsert({ type: 'case.opened', entity: 'e', data: { blob: 'x'.repeat(70_000) } }),
    ).toThrow(/too large/);
  });
});
