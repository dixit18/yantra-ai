// Capability probes with injectable dependencies so the rules stay unit-tested:
// canvas upgrades only when motion is full AND WebGL exists. SSR-safe.
export interface MediaQuery {
  matches: boolean;
}

export function prefersReducedMotion(matchMediaFn?: (query: string) => MediaQuery): boolean {
  try {
    const fn =
      matchMediaFn ?? (typeof window !== 'undefined' ? window.matchMedia.bind(window) : undefined);
    if (!fn) {
      return false;
    }
    return fn('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export interface CanvasLike {
  getContext: (kind: string) => { getParameter: (p: number) => unknown } | null;
}

export function webglAvailable(makeCanvas?: () => CanvasLike | null): boolean {
  try {
    const canvas = makeCanvas ? makeCanvas() : document.createElement('canvas');
    if (!canvas) {
      return false;
    }
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    return gl !== null && typeof gl.getParameter === 'function';
  } catch {
    return false;
  }
}
