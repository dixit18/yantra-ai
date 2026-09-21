// P1-OBS-005 — typed audit executor. Construction (allowlist, caps, scrub)
// lives in @yantra/contracts' buildAuditInsert; this executes it against the
// append-only audit_event table and maps the id.
import type { QueryFn } from '@yantra/db';
import {
  buildAuditInsert,
  type AuditEventInput,
  type AuditEventType,
  AUDIT_EVENT_TYPES,
} from '@yantra/contracts';

export type { AuditEventInput, AuditEventType };
export { AUDIT_EVENT_TYPES };

export async function writeAuditEvent(query: QueryFn, event: AuditEventInput): Promise<string> {
  const insert = buildAuditInsert(event);
  const rows = (await query(insert.sql, insert.params)).rows;
  const id = rows[0]?.['id'];
  if (typeof id !== 'string' || !id) {
    throw new Error('audit write did not return an id');
  }
  return id;
}
