import { expect, type APIRequestContext, type Locator, type Page, type TestInfo } from '@playwright/test';

const SAVE_PATH = '/__scrivania/save';

/**
 * A title no other spec, and no other repeat of the same spec, uses: the specs share one dev
 * server and one content directory, so a book saved by one run stays on the shelf for the next.
 */
export function uniqueTitle(base: string, testInfo: TestInfo): string {
  return `${base} r${testInfo.repeatEachIndex}`;
}

/** A spine's accessible name is `<titolo>, <autore>`: the comma keeps `r1` from matching `r10`. */
export function spine(page: Page, titolo: string): Locator {
  return page.getByRole('button', { name: `${titolo}, ` });
}

interface SavePayload {
  slug?: string;
  data: Record<string, unknown>;
  testo?: string;
}

/**
 * Clicks a button that saves, waits for the saved view the fresh `/scrivi/` shows, and goes back
 * to the shelf. `waitForURL` cannot wait for that: the sheet is already on `/scrivi/`, so it
 * matches at once and the next click lands on the page about to be replaced. The save response
 * is not awaited: the dev server's reload can replace the page before it arrives, which the saved
 * view is built to survive. A failed save leaves the form open and this times out.
 */
export async function saveAndReload(page: Page, saveButton: Locator): Promise<void> {
  await saveButton.click();
  await page.getByRole('button', { name: 'Torna alla mensola' }).click();
  await expect(page.locator('#scrivania-panel')).toBeHidden();
}

export async function addBook(page: Page, titolo: string): Promise<void> {
  await page.goto('/scrivi/');
  await page.getByRole('button', { name: '+ aggiungi' }).click();
  await page.locator('#nf-t').fill(titolo);
  await page.locator('#nf-a').fill('Autore di Prova');
  await saveAndReload(page, page.getByRole('button', { name: 'Inizia a leggerlo' }));
}

/** Saves a book straight to the endpoint, with no page involved; returns its slug. */
export async function saveBook(request: APIRequestContext, payload: SavePayload): Promise<string> {
  const res = await request.post(SAVE_PATH, { data: payload });
  expect(res.ok()).toBeTruthy();
  return ((await res.json()) as { slug: string }).slug;
}
