import { expect, test, type Locator } from '@playwright/test';
import { buildSite } from '../support/built-site.ts';
import { serveStatic } from '../support/static-server.ts';

const FIXTURES = { LETTURE_CONTENT_DIR: 'tests/fixtures/letture-post' };
const RED = { light: 'rgb(196, 43, 28)', dark: 'rgb(255, 106, 85)' } as const;

const style = (locator: Locator, property: 'textDecorationColor' | 'outlineColor') =>
  locator.evaluate((el, prop) => getComputedStyle(el)[prop], property);

for (const scheme of ['light', 'dark'] as const) {
  test(`red shows on link hover, keyboard focus and the current nav item in the ${scheme} scheme`, async ({ page }) => {
    const server = await serveStatic(buildSite(FIXTURES));
    try {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(`${server.url}/`);

      const link = page.locator('.projects a').first();
      expect(await style(link, 'textDecorationColor')).not.toBe(RED[scheme]);
      await link.hover();
      expect(await style(link, 'textDecorationColor')).toBe(RED[scheme]);

      const brand = page.locator('.brand');
      await brand.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(brand).toBeFocused();
      expect(await style(brand, 'outlineColor')).toBe(RED[scheme]);

      await page.goto(`${server.url}/letture/`);
      const current = page.locator('nav a[aria-current]');
      await expect(current).toHaveCount(1);
      expect(await style(current, 'textDecorationColor')).toBe(RED[scheme]);
      const other = page.locator('nav a:not([aria-current])').first();
      await other.hover();
      expect(await other.evaluate((el) => getComputedStyle(el).textDecorationLine)).toBe('none');
    } finally {
      await server.close();
    }
  });
}
