import { describe, expect, it } from 'vitest';
import { citationCoverage } from './index.js';

describe('citationCoverage', () => {
  it('scores full coverage as 1', () => {
    expect(citationCoverage(4, 4)).toBe(1);
  });

  it('scores partial coverage proportionally', () => {
    expect(citationCoverage(1, 4)).toBe(0.25);
  });

  it('clamps over-citation and handles empty sets', () => {
    expect(citationCoverage(9, 4)).toBe(1);
    expect(citationCoverage(0, 4)).toBe(0);
    expect(citationCoverage(0, 0)).toBe(1);
  });
});
