import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Playwright specs live here too — vitest must never collect them.
    exclude: ['e2e/**', 'node_modules/**', 'dist/**', '.next/**'],
  },
});
