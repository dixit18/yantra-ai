// P2-EMBED-014 — embedding boundary. Production vectors come from the
// configured model provider (needs MODEL_API_KEY — see DECISIONS); until then
// HashEmbedder stands in. It is deterministic and unit-normalized, so the
// pgvector pipeline (index, tenant filter, ordering, re-index) is exercised
// end to end — but its "similarities" carry no semantics. Never ship it as
// production quality; the swap point is this interface, nothing else.
import { createHash } from 'node:crypto';

export const EMBEDDING_DIMENSIONS = 1536;

export interface Embedder {
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}

function seededRandom(seed: Buffer): () => number {
  let state = seed.readUInt32BE(0);
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class HashEmbedder implements Embedder {
  readonly dimensions: number;

  constructor(dimensions: number = EMBEDDING_DIMENSIONS) {
    if (!Number.isInteger(dimensions) || dimensions <= 0) {
      throw new Error('embedding dimensions must be a positive integer');
    }
    this.dimensions = dimensions;
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => {
      const random = seededRandom(createHash('sha256').update(text, 'utf8').digest());
      const vector = Array.from({ length: this.dimensions }, () => random() * 2 - 1);
      const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
      return vector.map((v) => v / norm);
    });
  }
}

export function toVectorLiteral(vector: number[]): string {
  if (vector.some((v) => !Number.isFinite(v))) {
    throw new Error('embedding contains a non-finite component');
  }
  return `[${vector.join(',')}]`;
}
