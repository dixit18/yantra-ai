import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@yantra/ui/shell.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Yantra AI — Your best service engineer, on every machine',
  description:
    'Turn manuals, parts data, service history, and expert rules into a governed product specialist for customers, dealers, and technicians.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
