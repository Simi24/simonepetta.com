import { defineConfig, devices } from '@playwright/test';
import { makeTempDir } from './tests/support/temp-root.ts';

const port = 4591;
// A fresh, empty content dir per run: the writing desk must never touch src/content/letture/.
// Workers re-evaluate this file: they reuse the main process's dir through the environment, so
// the specs can seed files (e.g. a hand-made file name) straight into the dir the server reads.
const contentDir = process.env['LETTURE_CONTENT_DIR'] ?? makeTempDir('scrivania-dev-');
process.env['LETTURE_CONTENT_DIR'] = contentDir;

export default defineConfig({
  testDir: 'tests/browser-dev',
  forbidOnly: !!process.env['CI'],
  reporter: process.env['CI'] ? 'github' : 'list',
  // All specs share one real dev server and one real content directory (never test fixtures):
  // parallel workers would race each other's saves and content-collection refreshes.
  workers: 1,
  use: { baseURL: `http://localhost:${port}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // `astro dev` backgrounds itself when it detects an agent unless `--ignore-lock` is passed
    // (same mechanism as `astro preview`, see playwright.config.ts): always start a fresh,
    // foreground instance here, never reusing whatever dev server might already be running.
    command: `npm run dev -- --port ${port} --ignore-lock`,
    url: `http://localhost:${port}/scrivi/`,
    reuseExistingServer: false,
    env: { LETTURE_CONTENT_DIR: contentDir },
  },
});
