import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { buildSite, filesWithExtension } from '../support/built-site.ts';
import { serveStatic, type StaticServer } from '../support/static-server.ts';

const COLOR_SCHEMES = ['light', 'dark'] as const;

// tokens.css's --bg, light-dark(#ededeb, #151515): asserted so a broken color-scheme
// emulation can't silently check the light palette twice under the "dark" label.
const BODY_BACKGROUND: Record<(typeof COLOR_SCHEMES)[number], string> = {
  light: 'rgb(237, 237, 235)',
  dark: 'rgb(21, 21, 21)',
};

// The production build (today: an empty /letture/) and a build with the letture fixtures
// (books), so a populated shelf is axe-checked even though nothing is published yet.
const BUILDS: readonly { label: string; env: Record<string, string> }[] = [
  { label: 'production', env: {} },
  { label: 'letture fixtures', env: { LETTURE_CONTENT_DIR: 'tests/fixtures/letture' } },
];

const urlFor = (server: StaticServer, page: string): string => `${server.url}/${page.replace(/index\.html$/, '')}`;

async function axeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations;
}

for (const { label, env } of BUILDS) {
  test(`every page of the ${label} build passes axe (WCAG 2.2 AA) in light and dark`, async ({ page }) => {
    const dist = buildSite(env);
    const pages = filesWithExtension(dist, '.html');
    expect(pages.length).toBeGreaterThan(0);

    const server = await serveStatic(dist);
    try {
      for (const pagePath of pages) {
        for (const colorScheme of COLOR_SCHEMES) {
          await page.emulateMedia({ colorScheme });
          await page.goto(urlFor(server, pagePath));
          const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
          expect(background, `${pagePath}: the ${colorScheme} palette did not apply`).toBe(BODY_BACKGROUND[colorScheme]);
          const violations = await axeViolations(page);
          expect(violations, `${pagePath} (${colorScheme}):\n${JSON.stringify(violations, null, 2)}`).toEqual([]);
        }
      }
    } finally {
      await server.close();
    }
  });
}

test('axe catches low-contrast text (deliberately broken fixture)', async ({ page }) => {
  const server = await serveStatic('tests/fixtures/axe-broken');
  try {
    await page.goto(server.url);
    const violations = await axeViolations(page);
    expect(violations.some((violation) => violation.id === 'color-contrast')).toBe(true);
  } finally {
    await server.close();
  }
});

test('axe catches an invalid autocomplete value (deliberately broken fixture)', async ({ page }) => {
  const server = await serveStatic('tests/fixtures/axe-broken-autocomplete');
  try {
    await page.goto(server.url);
    const violations = await axeViolations(page);
    expect(violations.some((violation) => violation.id === 'autocomplete-valid')).toBe(true);
  } finally {
    await server.close();
  }
});
