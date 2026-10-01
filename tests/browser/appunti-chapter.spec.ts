import { expect, test, type Page } from '@playwright/test';
import { buildSite } from '../support/built-site.ts';
import { serveStatic, type StaticServer } from '../support/static-server.ts';

// Fixtures, never the real content: a math chapter with theorems, and one with a listing, a raster figure and a TikZ figure.
const dist = buildSite({ APPUNTI_CONTENT_DIR: 'tests/fixtures/appunti' });
const MATH_CHAPTER = '/appunti/corso-web/1-variabili-aleatorie-continue/';
const CODE_CHAPTER = '/appunti/corso-web/3-introduzione/';

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 800 };

let server: StaticServer;
test.beforeAll(async () => {
  server = await serveStatic(dist);
});
test.afterAll(async () => {
  await server.close();
});

async function open(page: Page, path: string, viewport = DESKTOP): Promise<void> {
  await page.setViewportSize(viewport);
  await page.goto(`${server.url}${path}`);
}

test('the chapter table of contents is sticky on the left on desktop and in flow on mobile', async ({ page }) => {
  await open(page, CODE_CHAPTER);
  const toc = page.locator('aside.toc');
  expect(await toc.evaluate((el) => getComputedStyle(el).position)).toBe('sticky');
  const proseLeft = await page.locator('.prose').evaluate((el) => el.getBoundingClientRect().left);
  expect(await toc.evaluate((el) => el.getBoundingClientRect().right)).toBeLessThan(proseLeft);

  await page.evaluate(() => window.scrollTo(0, 600));
  const top = await toc.evaluate((el) => el.getBoundingClientRect().top);
  expect(top, 'the TOC stays in view while the chapter scrolls').toBeGreaterThanOrEqual(0);
  expect(top).toBeLessThan(100);

  await open(page, CODE_CHAPTER, MOBILE);
  expect(await toc.evaluate((el) => getComputedStyle(el).position)).toBe('static');
});

test('a theorem label is bold, a proof label italic, the statement upright (SPEC.md §5.4)', async ({ page }) => {
  await open(page, MATH_CHAPTER);
  const label = page.locator('.ltx_theorem_theorem .ltx_tag_theorem .ltx_font_bold');
  expect(await label.evaluate((el) => getComputedStyle(el).fontWeight)).toBe('700');
  await expect(label).toHaveText('Teorema 1.2');
  const statement = page.locator('.ltx_theorem_theorem .ltx_para').first();
  expect(await statement.evaluate((el) => getComputedStyle(el).fontStyle)).toBe('normal');
  const proof = page.locator('.ltx_proof .ltx_title_proof');
  expect(await proof.evaluate((el) => getComputedStyle(el).fontStyle)).toBe('italic');
  await expect(page.locator('.ltx_proof')).toContainText('∎');
});

test('a note is an indented block with a rule, and its number is not repeated', async ({ page }) => {
  await open(page, MATH_CHAPTER);
  const note = page.locator('.ltx_note_outer');
  const { display, borderLeft } = await note.evaluate((el) => {
    const style = getComputedStyle(el);
    return { display: style.display, borderLeft: style.borderLeftWidth };
  });
  expect(display).toBe('block');
  expect(borderLeft).toBe('2px');
  await expect(page.locator('.ltx_tag_note')).toBeHidden();
});

test('math renders as native MathML in Fira Math, which is actually loaded', async ({ page }) => {
  const fonts: string[] = [];
  page.on('request', (request) => {
    if (/\.(woff2?|otf|ttf)$/.test(request.url())) fonts.push(request.url());
  });
  await open(page, MATH_CHAPTER);
  const math = page.locator('math').first();
  expect(await math.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^"?Fira Math/);
  const box = await math.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(5);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('1em "Fira Math"'))).toBe(true);
  expect(fonts.some((url) => url.endsWith('/fonts/fira-math.woff2'))).toBe(true);
});

test('a chapter without math does not request Fira Math', async ({ page }) => {
  const fonts: string[] = [];
  page.on('request', (request) => {
    if (/\.(woff2?|otf|ttf|css)$/.test(request.url())) fonts.push(request.url());
  });
  await open(page, '/appunti/corso-web/2-secondo/');
  expect(fonts.filter((url) => /fira-math/.test(url))).toEqual([]);
});

test('a numbered equation shows its number once, on the right of the formula', async ({ page }) => {
  await open(page, MATH_CHAPTER);
  const equation = page.locator('#E1');
  const { mathRight, tagLeft } = await equation.evaluate((el) => ({
    mathRight: el.querySelector('math')!.getBoundingClientRect().right,
    tagLeft: el.querySelector('.ltx_eqn_eqno[aria-hidden="true"]')!.getBoundingClientRect().left,
  }));
  expect(tagLeft).toBeGreaterThanOrEqual(mathRight);
});

test('lists drop the default indent, listings are monospace and numbered', async ({ page }) => {
  await open(page, CODE_CHAPTER);
  const list = await page.locator('.prose ul').first().evaluate((el) => {
    const style = getComputedStyle(el);
    return { padding: style.paddingLeft, marker: style.listStyleType, margin: style.marginLeft };
  });
  expect(list).toEqual({ padding: '0px', marker: 'none', margin: '0px' });

  const listing = page.locator('pre.listing').first();
  expect(await listing.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/mono|Menlo|Consolas/i);
  // Line numbers come from a CSS counter, which a computed style reports as its expression.
  expect(await listing.locator('.ltx_listingline').first().evaluate((el) => getComputedStyle(el, '::before').content)).toMatch(/^counter\(/);
  await expect(listing).toContainText('__global__ void hello_world()');
});

test('the chapter makes no script request beyond the page itself', async ({ page }) => {
  const scripts: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'script') scripts.push(request.url());
  });
  await open(page, MATH_CHAPTER);
  expect(scripts).toEqual([]);
});

test('the chapter does not scroll sideways on a phone', async ({ page }) => {
  await open(page, CODE_CHAPTER, MOBILE);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('figures are visible and keep their shape on mobile: no sideways scroll, image not stretched', async ({ page }) => {
  await open(page, CODE_CHAPTER, MOBILE);
  const img = page.locator('img.figura');
  await img.scrollIntoViewIfNeeded();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBe(684);
  const box = await img.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(390);
  expect(box!.width / box!.height).toBeCloseTo(684 / 426, 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const tikz = await page.locator('svg.figura-tikz').boundingBox();
  expect(tikz!.width).toBeLessThanOrEqual(390);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`in the ${colorScheme} theme a raster figure sits on a light sheet, never inverted, and a TikZ figure follows the text color`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await open(page, CODE_CHAPTER);
    const img = page.locator('img.figura');
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBe(684);
    const style = await img.evaluate((el) => {
      const computed = getComputedStyle(el);
      return { background: computed.backgroundColor, filter: computed.filter, loading: el.getAttribute('loading') };
    });
    expect(style).toEqual({ background: 'rgb(255, 255, 255)', filter: 'none', loading: 'lazy' });

    const tikz = page.locator('svg.figura-tikz');
    await expect(tikz).toBeVisible();
    const colors = await page.evaluate(() => ({
      figure: getComputedStyle(document.querySelector('svg.figura-tikz')!).color,
      text: getComputedStyle(document.querySelector('.prose p')!).color,
    }));
    expect(colors.figure).toBe(colors.text);
    // The strokes are currentColor: nothing in the picture is a fixed black.
    expect(await tikz.evaluate((el) => /#000|black/.test(el.outerHTML))).toBe(false);
    expect(await tikz.evaluate((el) => el.getAttribute('aria-label'))).toBeTruthy();
  });
}
