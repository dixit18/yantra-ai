// P1-UI-006 — primitive components. No default-template styling anywhere:
// every visual comes from shell.css tokens. Pure (no hooks), so server
// rendering and unit tests share one path.
import type { ReactNode } from 'react';

export function SiteMark({ label = 'Yantra AI mark' }: { label?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width="28"
      height="28"
      role="img"
      aria-label={label}
      className="y-mark"
    >
      <g stroke="currentColor" strokeWidth="2" fill="none">
        <rect x="7" y="7" width="18" height="18" />
        <path d="M16 7v18M7 16h18" />
        <circle cx="16" cy="16" r="2.5" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}

export interface ButtonProps {
  variant?: 'primary' | 'ghost';
  href: string;
  children: ReactNode;
}

export function Button({ variant = 'primary', href, children }: ButtonProps) {
  return (
    <a className={variant === 'primary' ? 'y-btn y-btn-primary' : 'y-btn y-btn-ghost'} href={href}>
      {children}
    </a>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return <span className="y-chip">{children}</span>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="y-eyebrow">{children}</p>;
}
