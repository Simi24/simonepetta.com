import { expect, test } from '@playwright/test';
import { buildSite } from '../support/built-site.ts';
import { serveStatic } from '../support/static-server.ts';

const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 390, height: 800 };

test('the full course list has no default list indent', async ({ page }) => {
  const server = await serveStatic(buildSite({ APPUNTI_CONTENT_DIR: 'tests/fixtures/appunti' }));
  try {
    for (const viewport of [DESKTOP, MOBILE]) {
      await page.setViewportSize(viewport);
      await page.goto(`${server.url}/appunti/`);
      const list = page.locator('#elenco ul');
      await expect(list).toHaveCount(1);
      const { listLeft, sectionLeft, headingLeft, style } = await page.evaluate(() => {
        const ul = document.querySelector('#elenco ul')!;
        const section = document.querySelector('#elenco')!;
        const h2 = document.querySelector('#elenco h2')!;
        const s = getComputedStyle(ul);
        return {
          listLeft: ul.getBoundingClientRect().left,
          sectionLeft: section.getBoundingClientRect().left,
          headingLeft: h2.getBoundingClientRect().left,
          style: { paddingLeft: s.paddingLeft, listStyleType: s.listStyleType, marginLeft: s.marginLeft },
        };
      });
      expect(style, `${viewport.width}px`).toEqual({ paddingLeft: '0px', listStyleType: 'none', marginLeft: '0px' });
      if (viewport === MOBILE) expect(listLeft).toBe(sectionLeft);
      else expect(listLeft).toBeGreaterThan(headingLeft + 100); // starts at column 5, not at the label
    }
  } finally {
    await server.close();
  }
});

test('the list’s first column aligns with the list’s own left edge', async ({ page }) => {
  const server = await serveStatic(buildSite({ APPUNTI_CONTENT_DIR: 'tests/fixtures/appunti' }));
  try {
    await page.setViewportSize(DESKTOP);
    await page.goto(`${server.url}/appunti/`);
    const { ulLeft, nameLeft } = await page.evaluate(() => ({
      ulLeft: document.querySelector('#elenco ul')!.getBoundingClientRect().left,
      nameLeft: document.querySelector('#elenco li a')!.getBoundingClientRect().left,
    }));
    expect(nameLeft).toBe(ulLeft);
  } finally {
    await server.close();
  }
});
