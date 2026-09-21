import { describe, expect, it } from 'vitest';
import { currentCorrelationId, runWithCorrelationId } from './context.js';
import { createCorrelationId } from './index.js';

describe('correlation context', () => {
  it('is absent outside a scope', () => {
    expect(currentCorrelationId()).toBeUndefined();
  });

  it('propagates across async boundaries within a scope', async () => {
    const id = createCorrelationId();
    await runWithCorrelationId(id, async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(currentCorrelationId()).toBe(id);
    });
    expect(currentCorrelationId()).toBeUndefined();
  });

  it('isolates concurrent scopes', async () => {
    const seen: (string | undefined)[] = [];
    await Promise.all([
      runWithCorrelationId('a', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        seen.push(currentCorrelationId());
      }),
      runWithCorrelationId('b', async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        seen.push(currentCorrelationId());
      }),
    ]);
    expect(seen.sort()).toEqual(['a', 'b']);
  });
});
