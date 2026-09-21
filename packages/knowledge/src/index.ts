// P2-DOC-011 — document/version lifecycle (state machine, supersession).
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

export * from './documents.js';
