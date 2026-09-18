import { describe, expect, it } from 'vitest';
import { isSupersededAt } from './index.js';

describe('isSupersededAt', () => {
  it('treats open-ended versions as current', () => {
    expect(isSupersededAt({}, new Date('2026-09-18'))).toBe(false);
    expect(isSupersededAt({ effectiveTo: null }, new Date('2026-09-18'))).toBe(false);
  });

  it('flags versions past their effective end', () => {
    const at = new Date('2026-09-18');
    expect(isSupersededAt({ effectiveTo: '2026-01-01' }, at)).toBe(true);
    expect(isSupersededAt({ effectiveTo: '2027-01-01' }, at)).toBe(false);
  });
});
