import { defineConfig, devices } from '@playwright/test';

// The quality gates (axe, SPEC.md §12.1) check the builds `tests/quality/quality-setup.ts` prepares,
// served by a static server per test; no shared dev server is needed.
export default defineConfig({
  testDir: 'tests/quality',
  // tests/quality/ also holds budget.test.ts (a node:test file, run by `npm test`): exclude it here.
  testMatch: /.*\.spec\.ts/,
  // Builds the quality builds once, before the specs enumerate their pages.
  globalSetup: './tests/quality/quality-setup.ts',
  // Every test is independent: it serves the build on its own ephemeral port and loads one page,
  // and no assertion depends on timing, so the pages run in parallel. 4 workers match the 4 vCPUs
  // of a GitHub-hosted runner (the setup builds run once, before the workers start).
  fullyParallel: true,
  // Locally Playwright picks the worker count; exactOptionalPropertyTypes forbids an explicit undefined.
  ...(process.env['CI'] ? { workers: 4 } : {}),
  forbidOnly: !!process.env['CI'],
  reporter: process.env['CI'] ? 'github' : 'list',
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // No gate depends on the network: every host except the local static server fails to
        // resolve, so the analytics beacon (SPEC.md §12.4) never loads, online or offline.
        launchOptions: { args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] },
      },
    },
  ],
});
