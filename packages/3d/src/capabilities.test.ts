import { describe, expect, it } from 'vitest';
import { prefersReducedMotion, webglAvailable } from './capabilities.js';

describe('prefersReducedMotion', () => {
  it('reads the media query', () => {
    expect(prefersReducedMotion(() => ({ matches: true }))).toBe(true);
    expect(prefersReducedMotion(() => ({ matches: false }))).toBe(false);
  });

  it('fails safe when matchMedia is missing or throws', () => {
    expect(prefersReducedMotion(undefined)).toBe(false);
    expect(
      prefersReducedMotion(() => {
        throw new Error('no matchMedia');
      }),
    ).toBe(false);
  });
});

describe('webglAvailable', () => {
  const ctx = { getParameter: () => 'ok' };

  it('accepts a working context', () => {
    expect(webglAvailable(() => ({ getContext: () => ctx }))).toBe(true);
  });

  it('falls back from webgl2 to webgl', () => {
    let calls = 0;
    expect(
      webglAvailable(() => ({
        getContext: (kind: string) => {
          calls += 1;
          return kind === 'webgl' ? ctx : null;
        },
      })),
    ).toBe(true);
    expect(calls).toBe(2);
  });

  it('rejects missing canvas, null contexts, and throws', () => {
    expect(webglAvailable(() => null)).toBe(false);
    expect(webglAvailable(() => ({ getContext: () => null }))).toBe(false);
    expect(
      webglAvailable(() => {
        throw new Error('no canvas');
      }),
    ).toBe(false);
  });
});
