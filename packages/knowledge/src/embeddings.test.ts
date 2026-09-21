import { describe, expect, it } from 'vitest';
import { EMBEDDING_DIMENSIONS, HashEmbedder, toVectorLiteral } from './embeddings.js';

describe('HashEmbedder', () => {
  it('is deterministic and unit-normalized', async () => {
    const embedder = new HashEmbedder(8);
    const [a, b] = await embedder.embed(['seal kit', 'seal kit']);
    expect(a).toEqual(b);
    const norm = Math.sqrt((a ?? []).reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1);
  });

  it('separates distinct texts', async () => {
    const embedder = new HashEmbedder(64);
    const [a, b] = await embedder.embed(['seal kit', 'bearing housing']);
    const cosine = (a ?? []).reduce((sum, v, i) => sum + v * (b?.[i] ?? 0), 0);
    expect(Math.abs(cosine)).toBeLessThan(0.5);
  });

  it('rejects bad dimensions', () => {
    expect(() => new HashEmbedder(0)).toThrow(/positive integer/);
    expect(() => new HashEmbedder(2.5)).toThrow(/positive integer/);
  });

  it('defaults to the production-compatible dimension', () => {
    expect(new HashEmbedder().dimensions).toBe(EMBEDDING_DIMENSIONS);
  });
});

describe('toVectorLiteral', () => {
  it('formats pgvector literals and rejects non-finite input', () => {
    expect(toVectorLiteral([1, 0.5, -2])).toBe('[1,0.5,-2]');
    expect(() => toVectorLiteral([1, Number.NaN])).toThrow(/non-finite/);
  });
});
