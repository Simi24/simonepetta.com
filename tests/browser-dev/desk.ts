import { expect, test as base, type APIRequestContext, type Locator, type Page, type TestInfo } from '@playwright/test';

const SAVE_PATH = '/__scrivania/save';

function isFullReload(message: string | Buffer): boolean {
  try {
    return (JSON.parse(message.toString()) as { type?: string }).type === 'full-reload';
  } catch {
    return false;
  }
}

/**
 * `test`, with two changes. First, the page never obeys Vite's `full-reload`. Astro sends it to every open
 * page each time the content store is written, which any save does (and, under load, a late
 * file-watcher sync can do again, after the page under test has loaded): the sheet would reload
 * under the spec and lose its text. It is not needed either: `refreshContent` flushes the store
 * before the save responds, so the sheet's own navigation after a save already loads fresh data.
 * Second, a save's response is held until the new content is served (see below).
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.routeWebSocket(/./, (ws) => {
      const server = ws.connectToServer();
      ws.onMessage((message) => server.send(message));
      server.onMessage((message) => {
        if (!isFullReload(message)) ws.send(message);
      });
    });
    // Holds a successful save's response until the desk page is served with what it saved: the sheet
    // navigates as soon as it gets the response, and that page could be rendered from the old content.
    await page.route(`**${SAVE_PATH}`, async (route) => {
      const response = await route.fetch();
      if (response.ok()) await waitUntilServed(page.request, route.request().postDataJSON() as SavePayload);
      await route.fulfill({ response });
    });
    await use(page);
  },
});

export { expect };

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

interface ServedBook {
  titolo: string;
  stato: string;
  testo: string | null;
}

/** The books the desk page is served with, read from its data island. */
async function servedBooks(request: APIRequestContext): Promise<ServedBook[]> {
  const html = await (await request.get('/scrivi/')).text();
  const island = /id="scrivania-data"[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1];
  return island === undefined ? [] : (JSON.parse(island) as { books: ServedBook[] }).books;
}

/**
 * Resolves once the desk page is served with what `payload` saved. The save responds after
 * `refreshContent`, but a page requested in the next few milliseconds can still be rendered from
 * the previous content (seen: about 1 in 4 right after a book's second save).
 */
async function waitUntilServed(request: APIRequestContext, { data, testo }: SavePayload): Promise<void> {
  await expect
    .poll(async () => {
      const book = (await servedBooks(request)).find((b) => b.titolo === data['titolo']);
      return book !== undefined && book.stato === data['stato'] && (testo === undefined || (book.testo ?? '') === testo.trim());
    }, { message: `the desk page is not served with the saved "${String(data['titolo'])}"` })
    .toBe(true);
}

/**
 * Clicks a button that saves, and resolves once the save succeeded and the sheet has navigated
 * back to the shelf. `waitForURL` cannot wait for that: the sheet does `location.assign('/scrivi/')`
 * while already on `/scrivi/`, so it matches at once and the next click lands on the page about
 * to be replaced. The `page` fixture holds the response until the new content is served, so the
 * page this resolves on shows what was saved.
 */
export async function saveAndReload(page: Page, saveButton: Locator): Promise<void> {
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === SAVE_PATH),
    page.waitForEvent('load'),
    saveButton.click(),
  ]);
  expect(response.ok()).toBe(true);
}

export async function addBook(page: Page, titolo: string): Promise<void> {
  await page.goto('/scrivi/');
  await page.getByRole('button', { name: '+ aggiungi' }).click();
  await page.locator('#nf-t').fill(titolo);
  await page.locator('#nf-a').fill('Autore di Prova');
  await saveAndReload(page, page.getByRole('button', { name: 'Inizia a leggerlo' }));
}

/** Saves a book straight to the endpoint, with no page involved, and waits until it is served; returns its slug. */
export async function saveBook(request: APIRequestContext, payload: SavePayload): Promise<string> {
  const res = await request.post(SAVE_PATH, { data: payload });
  expect(res.ok()).toBeTruthy();
  await waitUntilServed(request, payload);
  return ((await res.json()) as { slug: string }).slug;
}
