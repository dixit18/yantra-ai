import { describe, expect, it } from 'vitest';
import { finishRun, hashInput, recordStep, startRun } from './trace.js';

describe('run trace', () => {
  it('hashes inputs instead of storing them', () => {
    expect(hashInput('same')).toBe(hashInput('same'));
    expect(hashInput('same')).not.toContain('same');
    expect(hashInput('a')).not.toBe(hashInput('b'));
  });

  it('writes runs, scrubbed steps, and completions', async () => {
    const seen: { sql: string; params: unknown[] }[] = [];
    const query = async (sql: string, params?: unknown[]) => {
      seen.push({ sql, params: params ?? [] });
      if (sql.startsWith('insert into agent_run')) {
        return { rows: [{ id: 'run-1' }] };
      }
      return { rows: [] };
    };
    const runId = await startRun(query, {
      tenantId: 't-1',
      workflow: 'specialist',
      inputHash: hashInput('SEAL-204? password=hunter2'),
    });
    expect(runId).toBe('run-1');
    await recordStep(query, {
      runId,
      seq: 1,
      node: 'classify_intent',
      input: { message: 'SEAL-204? password=hunter2' },
      output: { intent: 'parts' },
    });
    await finishRun(query, { runId, status: 'answered', confidence: 0.8 });
    const joined = seen.map((s) => s.sql).join('\n');
    expect(joined).toContain('insert into agent_run');
    expect(joined).toContain('insert into agent_step');
    expect(joined).toContain('status = $1');
    const stepParams = seen.find((s) => s.sql.startsWith('insert into agent_step'))?.params ?? [];
    expect(JSON.stringify(stepParams)).not.toContain('hunter2');
    expect(JSON.stringify(stepParams)).toContain('[REDACTED]');
  });
});
