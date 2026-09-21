// P1-UI-006 — application shell: skip link, brand header, primary nav,
// main landmark, footer. One shell for marketing and (later) console surfaces.
import type { ReactNode } from 'react';
import { SiteMark } from './primitives.js';

export interface ShellNavItem {
  href: string;
  label: string;
}

export interface ShellProps {
  brandHref?: string;
  nav: ShellNavItem[];
  footerNote: string;
  children: ReactNode;
}

export function Shell({ brandHref = '/', nav, footerNote, children }: ShellProps) {
  return (
    <div className="y-shell">
      <a className="y-skip" href="#main">
        Skip to content
      </a>
      <header className="y-header">
        <a className="y-brand" href={brandHref} aria-label="Yantra AI home">
          <SiteMark />
          <span className="y-brand-name">Yantra AI</span>
        </a>
        <nav className="y-nav" aria-label="Primary">
          <ul>
            {nav.map((item, index) => (
              <li key={`${index}:${item.href}:${item.label}`}>
                <a href={item.href}>{item.label}</a>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main id="main" className="y-main" tabIndex={-1}>
        {children}
      </main>
      <footer className="y-footer">
        <p>{footerNote}</p>
      </footer>
    </div>
  );
}
