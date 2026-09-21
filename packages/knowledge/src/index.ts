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

export * from './pdf.js';

export * from './spreadsheet.js';

// HashEmbedder is deliberately NOT re-exported: it is a test/dev stand-in
// with no semantics (see embeddings.ts). Tests import it from the module
// directly; production code cannot stumble into it through the barrel.
export { EMBEDDING_DIMENSIONS, toVectorLiteral } from './embeddings.js';
export type { Embedder } from './embeddings.js';

export * from './segments.js';
