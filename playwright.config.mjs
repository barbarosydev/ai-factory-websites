import { defineConfig } from '@playwright/test';

const port = process.env.SITE_SERVER_PORT || '4173';
const siteRoot = process.env.SITE_WORKTREE_ROOT || process.cwd();

export default defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.mjs/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: process.env.PW_REPORTER || 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    headless: true,
    trace: 'off',
  },
  webServer: {
    command: `node scripts/serve.mjs --port ${port} --root "${siteRoot}"`,
    url: `http://127.0.0.1:${port}/__health`,
    reuseExistingServer: false,
    timeout: 10_000,
  },
});
