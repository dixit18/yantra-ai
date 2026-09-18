// P1-REPO-001 seed for P2-DOC-011 — supersession predicate over effective dates.
// Retrieval must exclude superseded versions; conflicts abstain (master spec §10.6).
export interface VersionWindow {
  effectiveFrom?: string;
  effectiveTo?: string | null;
}

export function isSupersededAt(version: VersionWindow, at: Date = new Date()): boolean {
  if (!version.effectiveTo) {
    return false;
  }
  return new Date(version.effectiveTo).getTime() <= at.getTime();
}
