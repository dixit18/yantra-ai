// P2-AGENT-017 — confidence from observable signals (master spec §11.3),
// never from a model's self-score. Capped below 1.0 by design: no answer is
// certain, and the cap forces the validator to keep checking.
import type { RiskClass } from './index.js';

export interface ConfidenceSignals {
  exactHits: number;
  sources: number;
  distinctDocs: number;
  riskClass: RiskClass;
}

export const MAX_CONFIDENCE = 0.97;

export function computeConfidence(signals: ConfidenceSignals): number {
  let score = 0.2;
  if (signals.exactHits > 0) {
    score += 0.3;
  }
  score += 0.1 * Math.min(signals.distinctDocs, 3);
  if (signals.sources >= 3) {
    score += 0.1;
  }
  const penalty: Record<RiskClass, number> = { R0: 0, R1: 0.05, R2: 0.15, R3: 0.3, R4: 1 };
  score -= penalty[signals.riskClass] ?? 0;
  return Math.min(MAX_CONFIDENCE, Math.max(0, Math.round(score * 100) / 100));
}
