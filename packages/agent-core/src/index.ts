// P1-REPO-001 seed for P2-AGENT-017 / P3-RISK-024 — R0-R4 risk ordering.
// The graph runtime and policy engine arrive in their own tasks; ordering is stable.
export const RiskRank = {
  R0: 0,
  R1: 1,
  R2: 2,
  R3: 3,
  R4: 4,
} as const;
export type RiskClass = keyof typeof RiskRank;

export function riskOutranks(a: RiskClass, b: RiskClass): boolean {
  return RiskRank[a] > RiskRank[b];
}

export * from './intent.js';
export * from './confidence.js';
export * from './drafter.js';
export * from './trace.js';
export * from './specialist.js';
