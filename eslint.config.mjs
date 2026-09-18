// P1-REPO-001 — flat config (ESLint 9) with TypeScript support.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.turbo/**',
      'data/**',
      // Owner scaffold; @neon/config wiring lands with the Neon-wiring follow-up
      // after P1-ENV-002 (see DECISIONS.md).
      'neon.ts',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
