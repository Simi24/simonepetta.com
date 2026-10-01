import { expect, test } from '@playwright/test';
import { buildSite } from '../support/built-site.ts';
import { serveStatic } from '../support/static-server.ts';

const FIXTURES = { LETTURE_CONTENT_DIR: 'tests/fixtures/letture-post' };
const PHONE = { width: 390, height: 800 };
const NARROW = { width: 320, height: 800 };

test('at 390px the header takes at most two lines and keeps the theme toggle reachable, in both languages', async ({ page }) => {
  const server = await serveStatic(buildSite(FIXTURES));
  try {
    await page.setViewportSize(PHONE);
    for (const [path, toggleName] of [['/', /^Tema/], ['/en/', /^Theme/]] as const) {
      await page.goto(`${server.url}${path}`);
      const { height, lineHeight, scrollWidth } = await page.evaluate(() => {
        const header = document.querySelector('.site-header')!;
        return {
          height: header.getBoundingClientRect().height,
          lineHeight: parseFloat(getComputedStyle(header).lineHeight),
          scrollWidth: document.documentElement.scrollWidth,
        };
      });
      // Two lines of text plus the 1rem row gap between them (about 71px), with slack for rounding.
      expect(height).toBeLessThanOrEqual(lineHeight * 2 + 20);
      expect(scrollWidth).toBeLessThanOrEqual(PHONE.width);

      const toggle = page.getByRole('button', { name: toggleName });
      await expect(toggle).toBeVisible();
      const box = (await toggle.boundingBox())!;
      expect(box.x + box.width).toBeLessThanOrEqual(PHONE.width);

      await toggle.focus();
      await expect(toggle).toBeFocused();
    }
  } finally {
    await server.close();
  }
});

test('at 320px the header does not scroll horizontally', async ({ page }) => {
  const server = await serveStatic(buildSite(FIXTURES));
  try {
    await page.setViewportSize(NARROW);
    for (const path of ['/', '/en/']) {
      await page.goto(`${server.url}${path}`);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(NARROW.width);
    }
  } finally {
    await server.close();
  }
});

test('on mobile the course facts line up on a shared baseline', async ({ page }) => {
  const server = await serveStatic(buildSite({ APPUNTI_CONTENT_DIR: 'tests/fixtures/appunti' }));
  try {
    await page.setViewportSize(PHONE);
    await page.goto(`${server.url}/appunti/corso-web/`);
    const alignItems = await page.evaluate(() => getComputedStyle(document.querySelector('.facts')!).alignItems);
    expect(alignItems).toBe('baseline');
  } finally {
    await server.close();
  }
});

for (const [label, viewport] of [['390px', PHONE], ['desktop', { width: 1280, height: 900 }]] as const) {
  test(`at ${label} Tab follows the header's visual order, in both languages`, async ({ page }) => {
    const server = await serveStatic(buildSite(FIXTURES));
    try {
      await page.setViewportSize(viewport);
      for (const path of ['/', '/en/']) {
        await page.goto(`${server.url}${path}`);
        // Expected order comes from where each control is drawn: line by line, left to right.
        const visual = await page.evaluate(() => {
          const controls = [...document.querySelectorAll<HTMLElement>('.site-header a, .site-header button')]
            .filter((el) => el.checkVisibility())
            .map((el) => {
            const r = el.getBoundingClientRect();
            return { text: el.textContent!.trim(), x: r.left, y: r.top + r.height / 2 };
          });
          controls.sort((a, b) => (Math.abs(a.y - b.y) > 10 ? a.y - b.y : a.x - b.x));
          return controls.map((c) => c.text);
        });
        expect(visual.length).toBeGreaterThan(1);

        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        const tabbed: string[] = [];
        for (let i = 0; i < visual.length; i++) {
          await page.keyboard.press('Tab');
          tabbed.push(await page.evaluate(() => document.activeElement!.textContent!.trim()));
        }
        expect(tabbed).toEqual(visual);
      }
    } finally {
      await server.close();
    }
  });
}
