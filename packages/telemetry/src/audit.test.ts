import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { POSTGRES_POOL_OPTIONS, type QueryRow } from '@yantra/db';
import { writeAuditEvent } from './audit.js';

describe('writeAuditEvent (scripted)', () => {
  it('executes the built insert and returns its id', async () => {
    const seen: string[] = [];
    const id = await writeAuditEvent(
      async (sql: string, params?: unknown[]) => {
        seen.push(sql);
        expect(params?.[2]).toBe('case.opened');
        return { rows: [{ id: 'a-1' }] };
      },
      { tenantId: 't-1', type: 'case.opened', entity: 'service_case', entityId: 'c-1' },
    );
    expect(id).toBe('a-1');
    expect(seen.join('\n')).toContain('insert into audit_event');
  });

  it('surfaces construction failures without touching the database', async () => {
    let called = false;
    const query = async (): Promise<{ rows: QueryRow[] }> => {
      called = true;
      return { rows: [{ id: 'x' }] };
    };
    await expect(writeAuditEvent(query, { type: 'case.opened', entity: '' })).rejects.toThrow(
      /type and an entity/,
    );
    expect(called).toBe(false);
  });
});

// Live write rolled back: proves the real INSERT path without littering the
// append-only table (its rows can never be deleted).
describe.skipIf(!process.env['DATABASE_URL'])('writeAuditEvent (live)', () => {
  const pool = new Pool({
    connectionString: process.env['DATABASE_URL'] as string,
    ...POSTGRES_POOL_OPTIONS,
  });
  afterAll(() => pool.end());

  it('writes and reads back inside a rolled-back transaction', async () => {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const query = async (sql: string, params?: unknown[]) => ({
        rows: (await client.query(sql, params)).rows as QueryRow[],
      });
      const id = await writeAuditEvent(query, {
        type: 'probe.write',
        entity: 'probe',
        entityId: 'p-1',
      });
      const back = await query('select type, entity from audit_event where id = $1', [id]);
      expect(back.rows).toEqual([{ type: 'probe.write', entity: 'probe' }]);
    } finally {
      await client.query('rollback');
      client.release();
    }
  });
});
