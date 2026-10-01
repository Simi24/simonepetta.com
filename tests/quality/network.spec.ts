import { expect, test } from '@playwright/test';
import { CLOUDFLARE_BEACON_SCRIPT_SRC } from '../../src/config/budget.ts';
import { serveStatic } from '../support/static-server.ts';

test('the quality browser cannot reach the network: the analytics beacon fails to load', async ({ page }) => {
  const failures: { url: string; reason: string }[] = [];
  page.on('requestfailed', (request) => failures.push({ url: request.url(), reason: request.failure()?.errorText ?? '' }));

  const server = await serveStatic('tests/fixtures/beacon-page');
  try {
    await page.goto(server.url);
  } finally {
    await server.close();
  }

  expect(failures).toEqual([{ url: CLOUDFLARE_BEACON_SCRIPT_SRC, reason: 'net::ERR_NAME_NOT_RESOLVED' }]);
});
