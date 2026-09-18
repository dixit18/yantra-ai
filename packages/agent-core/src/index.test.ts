import { describe, expect, it } from 'vitest';
import { RiskRank, riskOutranks } from './index.js';

describe('risk ordering', () => {
  it('ranks R0 lowest and R4 highest', () => {
    expect(RiskRank.R0).toBe(0);
    expect(RiskRank.R4).toBe(4);
  });

  it('compares classes without model judgement', () => {
    expect(riskOutranks('R3', 'R2')).toBe(true);
    expect(riskOutranks('R2', 'R2')).toBe(false);
    expect(riskOutranks('R0', 'R1')).toBe(false);
  });
});
