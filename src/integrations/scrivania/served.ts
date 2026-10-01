/** What `/scrivi/` serves for one book: the part of its data island a save can be checked against. */
export interface ServedBook {
  slug: string;
  titolo: string;
  stato: string;
  testo: string | null;
}

/** What a save wrote, as far as the served shelf can show it. `testo` is set only when the sheet sent a text. */
export interface SavedBook {
  slug: string;
  titolo: string;
  stato: string;
  testo?: string | undefined;
}

export interface WaitBounds {
  attempts: number;
  intervalMs: number;
}

/** Whether `books` (the shelf as served) already shows `saved`. */
export function shelfServes(books: ServedBook[], saved: SavedBook): boolean {
  const book = books.find((b) => b.slug === saved.slug);
  if (book === undefined || book.titolo !== saved.titolo || book.stato !== saved.stato) return false;
  return saved.testo === undefined || (book.testo ?? '') === saved.testo.trim();
}

/**
 * Resolves once the shelf serves `saved`; rejects after `attempts` looks. `refreshContent` returns
 * before the dev server's render path sees the new content, so the sheet, which navigates to
 * `/scrivi/` as soon as the save responds, could land on the previous shelf.
 */
export async function waitUntilServed(readShelf: () => Promise<ServedBook[]>, saved: SavedBook, { attempts, intervalMs }: WaitBounds): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (shelfServes(await readShelf(), saved)) return;
    if (attempt < attempts && intervalMs > 0) await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`/scrivi/ non serve ancora "${saved.titolo}" dopo il salvataggio`);
}

/** Reads the shelf from the desk page's data island (`scrivi.astro`). */
export async function fetchShelf(pageUrl: string): Promise<ServedBook[]> {
  const html = await (await fetch(pageUrl)).text();
  const island = /id="scrivania-data"[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1];
  return island === undefined ? [] : (JSON.parse(island) as { books: ServedBook[] }).books;
}
