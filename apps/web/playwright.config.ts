import { defineConfig, devices } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3100';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: BASE_URL },
  webServer: {
    command: 'pnpm --filter @yantra/web start',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
