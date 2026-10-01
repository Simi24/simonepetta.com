import { expect, test } from '@playwright/test';
import { buildSite } from '../support/built-site.ts';
import { serveStatic, type StaticServer } from '../support/static-server.ts';

const dist = buildSite({ APPUNTI_CONTENT_DIR: 'tests/fixtures/appunti' });
let server: StaticServer;
test.beforeAll(async () => {
  server = await serveStatic(dist);
});
test.afterAll(async () => {
  await server.close();
});

test('on the course page the notice sits in the content column, like the facts and the download', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${server.url}/appunti/corso-web/`);
  const left = (selector: string) => page.locator(selector).first().evaluate((el) => el.getBoundingClientRect().left);
  const notice = await left('.notice');
  expect(notice).toBe(await left('.facts'));
  expect(notice).toBe(await left('.download'));
});

test('the facts are set in Host Grotesk with tabular figures, like the rest of the page', async ({ page }) => {
  await page.goto(`${server.url}/appunti/corso-web/`);
  const style = await page.locator('.facts dd.num').first().evaluate((el) => {
    const s = getComputedStyle(el);
    return { family: s.fontFamily, numeric: s.fontVariantNumeric };
  });
  expect(style.family).toContain('Host Grotesk');
  expect(style.numeric).toContain('tabular-nums');
  const body = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(style.family).toBe(body);
});
