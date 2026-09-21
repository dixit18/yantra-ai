import { describe, expect, it } from 'vitest';
import { computeConfidence } from './confidence.js';

describe('computeConfidence', () => {
  it('rewards exact evidence and breadth, never certainty', () => {
    const best = computeConfidence({ exactHits: 9, sources: 9, distinctDocs: 9, riskClass: 'R0' });
    expect(best).toBeLessThan(1);
    expect(computeConfidence({ exactHits: 2, sources: 4, distinctDocs: 3, riskClass: 'R0' })).toBe(
      0.9,
    );
    expect(computeConfidence({ exactHits: 0, sources: 0, distinctDocs: 0, riskClass: 'R0' })).toBe(
      0.2,
    );
  });

  it('penalizes risk without collapsing on ordinary queries', () => {
    const base = { exactHits: 2, sources: 3, distinctDocs: 2, riskClass: 'R1' as const };
    expect(computeConfidence({ ...base, riskClass: 'R3' })).toBeLessThan(computeConfidence(base));
    expect(computeConfidence({ ...base, riskClass: 'R4' })).toBe(0);
  });
});
