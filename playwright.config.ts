import { defineConfig, devices } from '@playwright/test';

const port = 4322;

export default defineConfig({
  testDir: 'tests/browser',
  forbidOnly: !!process.env['CI'],
  reporter: process.env['CI'] ? 'github' : 'list',
  use: { baseURL: `http://localhost:${port}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // --ignore-lock keeps `astro preview` in the foreground: Astro backgrounds it when it detects an agent.
    command: `npm run build && npm run preview -- --port ${port} --ignore-lock`,
    url: `http://localhost:${port}/`,
    reuseExistingServer: false,
  },
});
