import { describe, expect, it } from 'vitest';
import { TOKENS } from './index.js';

const HEX_RE = /^#[0-9a-f]{6}$/i;

describe('TOKENS', () => {
  it('defines every color as a 6-digit hex value', () => {
    for (const [name, value] of Object.entries(TOKENS.color)) {
      expect(value, name).toMatch(HEX_RE);
    }
  });

  it('keeps semantic colors separate from the base palette', () => {
    const base = [TOKENS.color.graphite, TOKENS.color.paper, TOKENS.color.steel];
    expect(base).not.toContain(TOKENS.color.ok);
    expect(base).not.toContain(TOKENS.color.danger);
  });

  it('declares UI and mono font stacks', () => {
    expect(TOKENS.font.ui.length).toBeGreaterThan(0);
    expect(TOKENS.font.mono.length).toBeGreaterThan(0);
  });
});
