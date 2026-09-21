import { describe, expect, it } from 'vitest';
import { createLogger, droppedLogCount, redactSecrets, type LogRecord } from './logger.js';
import { runWithCorrelationId } from './context.js';

function capture() {
  const lines: string[] = [];
  const records = () => lines.map((line) => JSON.parse(line) as LogRecord);
  return { sink: (line: string) => lines.push(line), records };
}

describe('redactSecrets', () => {
  it('scrubs sensitive keys at any depth, arrays included', () => {
    const out = redactSecrets({
      user: 'ops',
      password: 'hunter2',
      nested: { apiKey: 'abc', list: [{ token: 't' }, 'fine'] },
    }) as Record<string, unknown>;
    expect(out['user']).toBe('ops');
    expect(out['password']).toBe('[REDACTED]');
    expect((out['nested'] as Record<string, unknown>)['apiKey']).toBe('[REDACTED]');
    expect(((out['nested'] as Record<string, unknown>)['list'] as unknown[])[1]).toBe('fine');
  });

  it('scrubs bearer credentials and database URLs in values', () => {
    expect(redactSecrets('Bearer abc.def.ghi')).toBe('[REDACTED]');
    expect(redactSecrets('postgresql://user:pw@host:5432/db')).toBe(
      'postgresql://***@host:5432/db',
    );
    expect(redactSecrets('plain text')).toBe('plain text');
  });

  it('leaves non-sensitive telemetry untouched', () => {
    expect(redactSecrets({ tenantId: 't-1', count: 3, ok: true })).toEqual({
      tenantId: 't-1',
      count: 3,
      ok: true,
    });
  });

  it('never pollutes the prototype through hostile keys', () => {
    redactSecrets(JSON.parse('{"__proto__":{"polluted":true},"a":1}'));
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});

describe('createLogger', () => {
  it('emits single-line JSON with scope, message, and redacted fields', () => {
    const { sink, records } = capture();
    createLogger('api', sink).info('request done', { tenantId: 't-1', apiKey: 'nope' });
    const [record] = records();
    expect(record?.scope).toBe('api');
    expect(record?.msg).toBe('request done');
    expect(record?.level).toBe('info');
    expect(typeof record?.ts).toBe('string');
    expect(record?.fields).toEqual({ tenantId: 't-1', apiKey: '[REDACTED]' });
  });

  it('carries the ambient correlation id across the request', () => {
    const { sink, records } = capture();
    runWithCorrelationId('req-123', () => {
      createLogger('api', sink).info('a');
      createLogger('db', sink).info('b');
    });
    expect(records().map((r) => r.correlationId)).toEqual(['req-123', 'req-123']);
  });

  it('filters below the configured level', () => {
    const { sink, records } = capture();
    const logger = createLogger('api', sink, 'warn');
    logger.debug('quiet');
    logger.info('quiet');
    logger.warn('loud');
    expect(records().map((r) => r.level)).toEqual(['warn']);
  });

  it('scrubs secrets interpolated into the message itself', () => {
    const { sink, records } = capture();
    const secret = 'live-secret-abc123';
    createLogger('api', sink).info(`token=${secret}`);
    const [record] = records();
    expect(record?.msg).not.toContain(secret);
    expect(record?.msg).toContain('[REDACTED]');
  });

  it('strips control characters from the scope', () => {
    const { sink, records } = capture();
    createLogger('api\ninjected: x', sink).info('hi');
    expect(records()[0]?.scope).toBe('api injected: x');
  });

  it('resolves correlation per emit, not per factory', () => {
    const { sink, records } = capture();
    const logger = createLogger('api', sink);
    logger.info('before scope');
    runWithCorrelationId('req-9', () => {
      logger.info('inside scope');
    });
    const ids = records().map((r) => r.correlationId);
    expect(ids[1]).toBe('req-9');
    expect(ids[0]).not.toBe('req-9');
  });

  it('counts dropped lines instead of throwing from a broken sink', () => {
    const before = droppedLogCount();
    const logger = createLogger('api', () => {
      throw new Error('sink down');
    });
    expect(() => logger.info('lost')).not.toThrow();
    expect(droppedLogCount()).toBe(before + 1);
  });
});
