import { expect, test, type Page } from '@playwright/test';

interface ProbeWindow {
  themeAtBody?: string | undefined;
}

const LIGHT_BG = 'rgb(237, 237, 235)';
const DARK_BG = 'rgb(21, 21, 21)';

const background = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const toggle = (page: Page) => page.getByRole('button', { name: /^(Tema|Theme):/ });

test('a stored dark theme is applied before the body is parsed', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('tema', 'dark');
    new MutationObserver((_, observer) => {
      if (!document.body) return;
      (window as ProbeWindow).themeAtBody = document.documentElement.dataset['theme'];
      observer.disconnect();
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto('/');
  expect(await page.evaluate(() => (window as ProbeWindow).themeAtBody)).toBe('dark');
  expect(await background(page)).toBe(DARK_BG);
  await expect(toggle(page)).toHaveText('Tema: scuro');
});

test('the toggle cycles system, light, dark and survives a reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(toggle(page)).toHaveText('Tema: sistema');
  expect(await background(page)).toBe(DARK_BG);

  await toggle(page).click();
  await expect(toggle(page)).toHaveText('Tema: chiaro');
  expect(await background(page)).toBe(LIGHT_BG);

  await page.reload();
  await expect(toggle(page)).toHaveText('Tema: chiaro');
  expect(await background(page)).toBe(LIGHT_BG);

  await toggle(page).click();
  await expect(toggle(page)).toHaveText('Tema: scuro');
  expect(await background(page)).toBe(DARK_BG);

  await toggle(page).click();
  await expect(toggle(page)).toHaveText('Tema: sistema');
  await page.reload();
  await expect(toggle(page)).toHaveText('Tema: sistema');
});

test('the toggle shows English labels on /en/ and cycles independently of the IT wording', async ({ page }) => {
  await page.goto('/en/');
  await expect(toggle(page)).toHaveText('Theme: system');
  await toggle(page).click();
  await expect(toggle(page)).toHaveText('Theme: light');
  await toggle(page).click();
  await expect(toggle(page)).toHaveText('Theme: dark');
});

test('with storage blocked the page follows the system and the toggle still works', async ({ page }) => {
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
  });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  expect(await background(page)).toBe(LIGHT_BG);
  await toggle(page).click();
  await toggle(page).click();
  await expect(toggle(page)).toHaveText('Tema: scuro');
  expect(await background(page)).toBe(DARK_BG);
  expect(errors).toEqual([]);
});
