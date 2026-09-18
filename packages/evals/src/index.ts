// P1-REPO-001 seed for P2-EVAL-018 — citation-coverage scorer.
// The dataset schema and runner arrive in P2-EVAL-018; scoring stays deterministic.
export function citationCoverage(citedFacts: number, totalFacts: number): number {
  if (totalFacts <= 0) {
    return 1;
  }
  if (citedFacts <= 0) {
    return 0;
  }
  return Math.min(1, citedFacts / totalFacts);
}
