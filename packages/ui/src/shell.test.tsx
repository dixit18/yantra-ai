import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Shell } from './shell.js';

const NAV = [
  { href: '#demo', label: 'Demo' },
  { href: '#problem', label: 'Problem' },
];

describe('Shell', () => {
  it('renders banner, navigation, main, and contentinfo landmarks', () => {
    const html = renderToStaticMarkup(
      <Shell nav={NAV} footerNote="Demo note">
        <p>Body</p>
      </Shell>,
    );
    expect(html).toContain('<header');
    expect(html).toContain('<nav');
    expect(html).toContain('<main');
    expect(html).toContain('<footer');
    expect(html).toContain('href="#main"');
    expect(html).toContain('Demo note');
    expect(html).toContain('Body');
  });

  it('makes the main region a skip-link target', () => {
    const html = renderToStaticMarkup(
      <Shell nav={NAV} footerNote="Note">
        <p>Body</p>
      </Shell>,
    );
    expect(html).toContain('id="main"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('Skip to content');
  });

  it('lists every nav item exactly once', () => {
    const html = renderToStaticMarkup(
      <Shell nav={NAV} footerNote="Note">
        <p>Body</p>
      </Shell>,
    );
    for (const item of NAV) {
      expect(html).toContain(`href="${item.href}"`);
      expect(html).toContain(item.label);
    }
  });
});
