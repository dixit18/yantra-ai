import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

  it('stays in sync with shell.css variables', async () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const css = await readFile(join(here, '..', 'shell.css'), 'utf8');
    for (const [name, value] of Object.entries(TOKENS.color)) {
      expect(css, name).toContain(value);
    }
    expect(css).toContain(TOKENS.font.ui);
    expect(css).toContain(TOKENS.font.mono);
  });

  it('holds AA contrast for small text on paper', () => {
    const luminance = (hex: string): number => {
      const rgb = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * (rgb[0] ?? 0) + 0.7152 * (rgb[1] ?? 0) + 0.0722 * (rgb[2] ?? 0);
    };
    const ratio = (a: string, b: string): number => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    // steel carries eyebrows, captions, and footer text — must clear 4.5:1.
    expect(ratio(TOKENS.color.steel, TOKENS.color.paper)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(TOKENS.color.graphite, TOKENS.color.paper)).toBeGreaterThanOrEqual(4.5);
  });
});
