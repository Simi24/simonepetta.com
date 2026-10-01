import { expect, test } from '@playwright/test';
import { buildSite } from '../support/built-site.ts';
import { serveStatic } from '../support/static-server.ts';

const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 390, height: 800 };
const FIXTURES = { LETTURE_CONTENT_DIR: 'tests/fixtures/letture-post' };

test('both book lists start exactly at column 5, with no default list indent', async ({ page }) => {
  const server = await serveStatic(buildSite(FIXTURES));
  try {
    await page.setViewportSize(DESKTOP);
    await page.goto(`${server.url}/letture/`);
    const { listLeft, shelfLeft, style, voteLeft, headingLeft } = await page.evaluate(() => {
      const list = document.querySelector('.books-group ul')!;
      const s = getComputedStyle(list);
      return {
        listLeft: list.getBoundingClientRect().left,
        shelfLeft: document.querySelector('.lede')!.getBoundingClientRect().left, // the lede sits at column 5
        voteLeft: list.querySelector('li > span')!.getBoundingClientRect().left,
        headingLeft: document.querySelector('.books-group h2')!.getBoundingClientRect().left,
        style: { paddingLeft: s.paddingLeft, marginLeft: s.marginLeft, listStyleType: s.listStyleType },
      };
    });
    expect(style).toEqual({ paddingLeft: '0px', marginLeft: '0px', listStyleType: 'none' });
    expect(listLeft).toBe(shelfLeft);
    expect(voteLeft).toBe(listLeft);
    expect(listLeft).toBeGreaterThan(headingLeft + 100);

    await page.goto(`${server.url}/`);
    const home = await page.evaluate(() => {
      const list = document.querySelector('.recent ul')!;
      const s = getComputedStyle(list);
      return {
        listLeft: list.getBoundingClientRect().left,
        headingLeft: document.querySelector('.recent h2')!.getBoundingClientRect().left,
        style: { paddingLeft: s.paddingLeft, marginLeft: s.marginLeft, listStyleType: s.listStyleType },
      };
    });
    expect(home.style).toEqual({ paddingLeft: '0px', marginLeft: '0px', listStyleType: 'none' });
    expect(home.listLeft).toBe(home.headingLeft);
  } finally {
    await server.close();
  }
});

test('on mobile the lists start at the section’s left edge', async ({ page }) => {
  const server = await serveStatic(buildSite(FIXTURES));
  try {
    await page.setViewportSize(MOBILE);
    await page.goto(`${server.url}/letture/`);
    const { listLeft, headingLeft } = await page.evaluate(() => ({
      listLeft: document.querySelector('.books-group ul')!.getBoundingClientRect().left,
      headingLeft: document.querySelector('.books-group h2')!.getBoundingClientRect().left,
    }));
    expect(listLeft).toBe(headingLeft);
  } finally {
    await server.close();
  }
});

test('a spine lifts on hover with a transition that reduced motion switches off', async ({ page }) => {
  const server = await serveStatic(buildSite(FIXTURES));
  try {
    await page.setViewportSize(DESKTOP);
    for (const reduce of ['no-preference', 'reduce'] as const) {
      await page.emulateMedia({ reducedMotion: reduce });
      await page.goto(`${server.url}/letture/`);
      const duration = await page.evaluate(() => getComputedStyle(document.querySelector('a.spine')!).transitionDuration);
      if (reduce === 'reduce') expect(duration).toBe('0s');
      else expect(duration).toBe('0.25s');
    }
  } finally {
    await server.close();
  }
});

test('on mobile the post facts line up on a shared baseline', async ({ page }) => {
  const server = await serveStatic(buildSite(FIXTURES));
  try {
    await page.setViewportSize(MOBILE);
    await page.goto(`${server.url}/letture/il-piu-recente/`);
    const alignItems = await page.evaluate(() => getComputedStyle(document.querySelector('.facts')!).alignItems);
    expect(alignItems).toBe('baseline');
  } finally {
    await server.close();
  }
});
