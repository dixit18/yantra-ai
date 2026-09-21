import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button, Chip, Eyebrow, SiteMark } from './primitives.js';

describe('primitives', () => {
  it('renders anchor buttons with variant classes, never dead buttons', () => {
    const primary = renderToStaticMarkup(<Button href="#demo">Go</Button>);
    expect(primary).toContain('href="#demo"');
    expect(primary).toContain('y-btn-primary');
    const ghost = renderToStaticMarkup(
      <Button variant="ghost" href="#problem">
        Why
      </Button>,
    );
    expect(ghost).toContain('y-btn-ghost');
  });

  it('renders mono chips and eyebrows for technical copy', () => {
    expect(renderToStaticMarkup(<Chip>SN YAN-PH-2041</Chip>)).toContain('class="y-chip"');
    expect(renderToStaticMarkup(<Eyebrow>Governed product specialist</Eyebrow>)).toContain(
      'class="y-eyebrow"',
    );
  });

  it('brands with a technical grid mark, not a robot', () => {
    const mark = renderToStaticMarkup(<SiteMark />);
    expect(mark).toContain('<svg');
    expect(mark).toContain('role="img"');
    expect(mark).not.toMatch(/robot|brain|sparkle|rocket/i);
  });

  it('ships no placeholder text', () => {
    const html = [
      renderToStaticMarkup(<Button href="#x">Real label</Button>),
      renderToStaticMarkup(<Chip>Part 123</Chip>),
    ].join('\n');
    expect(html).not.toMatch(/lorem|placeholder|todo/i);
  });
});
