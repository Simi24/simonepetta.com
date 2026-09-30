import { defineConfig, devices } from '@playwright/test';

// The quality gates (axe, SPEC.md §12.1) build and serve their own pages per test;
// no shared dev server is needed.
export default defineConfig({
  testDir: 'tests/quality',
  // tests/quality/ also holds budget.test.ts (a node:test file, run by `npm test`): exclude it here.
  testMatch: /.*\.spec\.ts/,
  forbidOnly: !!process.env['CI'],
  reporter: process.env['CI'] ? 'github' : 'list',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
