import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { buildSite } from '../support/built-site.ts';
import { serveStatic, type StaticServer } from '../support/static-server.ts';

// Fixtures, never the real content: a reading with text and a published course.
const dist = buildSite({
  LETTURE_CONTENT_DIR: 'tests/fixtures/letture-post',
  APPUNTI_CONTENT_DIR: 'tests/fixtures/appunti',
});

let server: StaticServer;
test.beforeAll(async () => {
  server = await serveStatic(dist);
});
test.afterAll(async () => {
  await server.close();
});

async function search(page: Page, query: string): Promise<void> {
  await page.goto(`${server.url}/cerca/`);
  await page.locator('.pagefind-ui__search-input').fill(query);
}

test('searching finds a course page', async ({ page }) => {
  await search(page, 'Probabilità');
  const results = page.locator('.pagefind-ui__result-link');
  await expect(results.first()).toBeVisible();
  await expect(results.first()).toHaveAttribute('href', /\/appunti\/corso-web\/$/);
});

test('searching finds a reading', async ({ page }) => {
  await search(page, 'citazione');
  const results = page.locator('.pagefind-ui__result-link');
  await expect(results.first()).toBeVisible();
  await expect(results.first()).toHaveAttribute('href', /\/letture\/il-piu-recente\/$/);
});

test('a search with no match says so, in Italian', async ({ page }) => {
  await search(page, 'zxqvnonesiste');
  await expect(page.locator('.pagefind-ui__message')).toContainText('Nessun risultato');
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`the results pass axe in the ${colorScheme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await search(page, 'Probabilità');
    await expect(page.locator('.pagefind-ui__result-link').first()).toBeVisible();
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
}
