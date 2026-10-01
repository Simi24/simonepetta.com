import { addBook, expect, saveAndReload, saveBook, spine, test, uniqueTitle } from './desk.ts';

// The writing sheet (SPEC.md §6.4) exists only under `astro dev`: this is the seam for the timer
// *starting*, the outline, the preview and the unsaved-text guard. The countdown's own tick-by-tick
// arithmetic and its "reaches zero" behavior are unit-tested with a fake clock in
// scrivania-timer.test.ts — not repeated here with a real (or browser-faked) 20-minute wait.

test('the timer starts at the first keystroke and never locks the sheet', async ({ page }, testInfo) => {
  const titolo = uniqueTitle('Il timer della scrivania', testInfo);
  await addBook(page, titolo);
  await spine(page, titolo).click();
  await page.getByRole('button', { name: "L'ho finito, scrivo" }).click();

  await expect(page.locator('.clock')).toHaveText('20:00');
  await expect(page.locator('.clock-note')).toHaveText('Parte quando inizi a scrivere.');

  await page.locator('#dk-text').fill('Una prima parola');
  await expect(page.locator('.clock-note')).toHaveText('Una passata sola, senza tornare indietro.');
  await expect(page.locator('.clock')).toHaveText('19:59');
  // The sheet must stay fully usable even mid-timer: never disabled.
  await expect(page.locator('#dk-text')).toBeEnabled();
});

test('the timer does not run while editing an existing text', async ({ page }, testInfo) => {
  const titolo = uniqueTitle('Il timer non riparte', testInfo);
  await addBook(page, titolo);
  await spine(page, titolo).click();
  await page.getByRole('button', { name: "L'ho finito, senza testo" }).click();
  await page.getByRole('button', { name: 'Voto 4', exact: true }).click();
  await saveAndReload(page, page.getByRole('button', { name: 'Salva', exact: true }));

  await spine(page, titolo).click();
  await page.getByRole('button', { name: 'Scrivi il testo' }).click();
  await page.locator('#dk-text').fill('Testo scritto una prima volta.');
  await saveAndReload(page, page.getByRole('button', { name: 'Salva', exact: true }));

  await spine(page, titolo).click();
  await page.getByRole('button', { name: 'Modifica', exact: true }).click();
  await expect(page.locator('.clock')).toBeHidden();
  await page.locator('#dk-text').fill('Testo scritto una prima volta. Aggiunta.');
  await expect(page.locator('.clock')).toBeHidden();
});

test('clicking an outline question inserts it as a `##` heading', async ({ page }, testInfo) => {
  const titolo = uniqueTitle('La traccia opzionale', testInfo);
  await addBook(page, titolo);
  await spine(page, titolo).click();
  await page.getByRole('button', { name: "L'ho finito, scrivo" }).click();

  await page.getByRole('button', { name: 'A cosa si collega' }).click();
  await expect(page.locator('#dk-text')).toHaveValue('## A cosa si collega\n\n');
});

test('grades are selectable in half points from 1 to 5', async ({ page }, testInfo) => {
  const titolo = uniqueTitle('Il voto a metà punto', testInfo);
  await addBook(page, titolo);
  await spine(page, titolo).click();
  await page.getByRole('button', { name: "L'ho finito, scrivo" }).click();

  const halfBetween3And4 = page.getByRole('button', { name: 'Voto 3,5' });
  await halfBetween3And4.click();
  await expect(halfBetween3And4).toHaveAttribute('aria-pressed', 'true');
});

test('the preview renders the real post component, not a copy of its markup', async ({ page }, testInfo) => {
  const titolo = uniqueTitle('Il diario di un lettore qualunque', testInfo);
  await addBook(page, titolo);
  await spine(page, titolo).click();
  await page.getByRole('button', { name: "L'ho finito, scrivo" }).click();
  await page.locator('#dk-text').fill('## A cosa si collega\n\nUna reazione sincera al libro.');

  await page.getByRole('button', { name: 'Anteprima' }).click();
  await expect(page.locator('.post .post-head h1')).toHaveText(titolo);
  await expect(page.locator('.post .prose h2')).toHaveText('A cosa si collega');
  await expect(page.locator('.post .prose p')).toHaveText('Una reazione sincera al libro.');

  await page.getByRole('button', { name: 'Torna a scrivere' }).click();
  await expect(page.locator('#dk-text')).toBeVisible();
});

test('finishing with a text produces a valid entry that carries over to the post', async ({ page }, testInfo) => {
  const titolo = uniqueTitle('Finito con testo', testInfo);
  await addBook(page, titolo);
  await spine(page, titolo).click();
  await page.getByRole('button', { name: "L'ho finito, scrivo" }).click();
  await page.locator('#dk-text').fill('La mia reazione al libro.');
  await page.getByRole('button', { name: 'Voto 4', exact: true }).click();
  await saveAndReload(page, page.getByRole('button', { name: 'Salva', exact: true }));

  await spine(page, titolo).click();
  await expect(page.getByRole('button', { name: 'Modifica', exact: true })).toBeVisible();
});

test('finishing without a text produces a valid entry, with no textarea offered again until asked for', async ({ page }, testInfo) => {
  const titolo = uniqueTitle('Finito senza testo', testInfo);
  await addBook(page, titolo);
  await spine(page, titolo).click();
  await page.getByRole('button', { name: "L'ho finito, senza testo" }).click();
  await page.getByRole('button', { name: 'Voto 3', exact: true }).click();
  await saveAndReload(page, page.getByRole('button', { name: 'Salva', exact: true }));

  await spine(page, titolo).click();
  await expect(page.getByRole('button', { name: 'Scrivi il testo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Modifica voto e dati' })).toBeVisible();
});

test('abandoning with a one-line note produces a valid entry', async ({ page }, testInfo) => {
  const titolo = uniqueTitle('Abbandonato a metà', testInfo);
  await addBook(page, titolo);
  await spine(page, titolo).click();
  await page.getByRole('button', { name: "L'ho lasciato a metà" }).click();
  await page.locator('#df-n').fill('a pagina 40, non mi convinceva');
  await saveAndReload(page, page.getByRole('button', { name: 'Mettilo di traverso' }));

  await spine(page, titolo).click();
  await expect(page.getByRole('button', { name: 'Ricomincia' })).toBeVisible();
});

test('leaving the sheet with unsaved text asks first, and staying keeps the text', async ({ page }, testInfo) => {
  const titolo = uniqueTitle('Il testo non confermato', testInfo);
  await addBook(page, titolo);
  await spine(page, titolo).click();
  await page.getByRole('button', { name: "L'ho finito, scrivo" }).click();
  await page.locator('#dk-text').fill('Testo che non ho ancora confermato.');

  page.once('dialog', (dialog) => void dialog.dismiss());
  await page.getByRole('button', { name: 'Indietro' }).click();
  await expect(page.locator('#dk-text')).toHaveValue('Testo che non ho ancora confermato.');

  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Indietro' }).click();
  await expect(page.getByRole('button', { name: "L'ho finito, scrivo" })).toBeVisible();
});

// Blocking fix: the shelf stays live above the panel, so every way of clicking out of the sheet —
// another spine, "+ aggiungi", or the same spine again — must ask before destroying the sheet, not
// just the sheet's own "Indietro" button.

test('the shelf cannot destroy the sheet: switching to another spine with unsaved text asks first', async ({ page, request }, testInfo) => {
  const primo = uniqueTitle('Primo libro della mensola', testInfo);
  const secondo = uniqueTitle('Secondo libro della mensola', testInfo);
  // Both books via a direct save, not `addBook()`: two `/scrivi/` navigations by the page itself,
  // back to back, raced each other often enough to be flaky. A single navigation at the end avoids it.
  for (const titolo of [primo, secondo]) {
    await saveBook(request, { data: { titolo, autore: 'Autore di Prova', stato: 'in-corso', iniziato: '2026-09-01' } });
  }
  await page.goto('/scrivi/');

  await spine(page, primo).click();
  await page.getByRole('button', { name: "L'ho finito, scrivo" }).click();
  await page.locator('#dk-text').fill('Testo che la mensola non deve distruggere.');

  page.once('dialog', (dialog) => void dialog.dismiss());
  await spine(page, secondo).click();
  await expect(page.locator('#dk-text')).toHaveValue('Testo che la mensola non deve distruggere.');

  page.once('dialog', (dialog) => void dialog.accept());
  await spine(page, secondo).click();
  await expect(page.locator('.actions .who b')).toHaveText(secondo);
});

test('deselecting the open book (clicking its own spine again) also asks first', async ({ page }, testInfo) => {
  const titolo = uniqueTitle('Libro da deselezionare', testInfo);
  await addBook(page, titolo);
  await spine(page, titolo).click();
  await page.getByRole('button', { name: "L'ho finito, scrivo" }).click();
  await page.locator('#dk-text').fill('Testo che non voglio perdere deselezionando.');

  page.once('dialog', (dialog) => void dialog.dismiss());
  await spine(page, titolo).click();
  await expect(page.locator('#dk-text')).toHaveValue('Testo che non voglio perdere deselezionando.');
});

test('clicking "+ aggiungi" with unsaved text in the sheet asks first too', async ({ page }, testInfo) => {
  const titolo = uniqueTitle('Libro prima di un nuovo libro', testInfo);
  await addBook(page, titolo);
  await spine(page, titolo).click();
  await page.getByRole('button', { name: "L'ho finito, scrivo" }).click();
  await page.locator('#dk-text').fill('Testo che il dorso tratteggiato non deve distruggere.');

  page.once('dialog', (dialog) => void dialog.dismiss());
  await page.getByRole('button', { name: '+ aggiungi' }).click();
  await expect(page.locator('#dk-text')).toHaveValue('Testo che il dorso tratteggiato non deve distruggere.');

  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: '+ aggiungi' }).click();
  await expect(page.getByRole('button', { name: 'Inizia a leggerlo' })).toBeVisible();
});

// Blocking fix: the sheet must never invent an `iniziato` date on an edit (only `finito` defaults
// to today, as the prototype does).

test('editing an existing text never invents an iniziato date', async ({ page, request }, testInfo) => {
  const titolo = uniqueTitle('Letto senza iniziato', testInfo);
  const data = { titolo, autore: 'Autore di Prova', stato: 'letto', finito: '2025-03-01' };
  const slug = await saveBook(request, { data });
  await saveBook(request, { slug, data, testo: 'Testo esistente, scritto in precedenza.' });

  await page.goto('/scrivi/');
  await spine(page, titolo).click();
  await page.getByRole('button', { name: 'Modifica', exact: true }).click();

  await expect(page.locator('#dk-start')).toHaveValue('');
  await expect(page.locator('#dk-end')).toHaveValue('2025-03-01');
});

// Blocking fix: a save response `warning` (the file was written, but refreshing the content
// collection failed) must be surfaced, not silently ignored.

test('a save warning is surfaced, not silently ignored', async ({ page }, testInfo) => {
  const titolo = uniqueTitle('Libro con un avviso del server', testInfo);
  await addBook(page, titolo);
  await spine(page, titolo).click();
  await page.getByRole('button', { name: "L'ho finito, scrivo" }).click();
  await page.locator('#dk-text').fill('Testo per il libro con avviso.');

  await page.route('**/__scrivania/save', async (route) => {
    await route.fulfill({ json: { slug: 'libro-con-un-avviso-del-server', warning: "l'aggiornamento del contenuto è fallito" } });
  });

  const dialogPromise = page.waitForEvent('dialog');
  await page.getByRole('button', { name: 'Salva', exact: true }).click();
  const dialog = await dialogPromise;
  expect(dialog.type()).toBe('alert');
  expect(dialog.message()).toContain("l'aggiornamento del contenuto è fallito");
  await dialog.dismiss();
});

// Also fix: the sheet never edits `nota`, but must still send it back unchanged on save.

test('the sheet preserves an existing nota on save, even though it never edits it', async ({ page, request }, testInfo) => {
  const titolo = uniqueTitle('Libro con nota residua', testInfo);
  await saveBook(request, {
    data: {
      titolo,
      autore: 'Autore di Prova',
      stato: 'letto',
      finito: '2026-01-01',
      nota: 'nota rimasta da una modifica a mano',
    },
  });

  await page.goto('/scrivi/');
  await spine(page, titolo).click();
  await page.getByRole('button', { name: 'Scrivi il testo' }).click();
  await page.locator('#dk-text').fill('Testo nuovo per questo libro.');

  // Waits for the save to finish too, so it cannot run into the next spec.
  const [saveRequest] = await Promise.all([
    page.waitForRequest('**/__scrivania/save'),
    saveAndReload(page, page.getByRole('button', { name: 'Salva', exact: true })),
  ]);
  const payload = JSON.parse(saveRequest.postData() ?? '{}') as { data?: { nota?: string } };
  expect(payload.data?.nota).toBe('nota rimasta da una modifica a mano');
});

// Also fix: the save button must not allow a double-submit while a save is in flight.

test('the save button is disabled while a save is in flight', async ({ page }, testInfo) => {
  const titolo = uniqueTitle('Libro con una richiesta lenta', testInfo);
  await addBook(page, titolo);
  await spine(page, titolo).click();
  await page.getByRole('button', { name: "L'ho finito, scrivo" }).click();
  await page.locator('#dk-text').fill('Testo di prova.');

  // The save is held until the spec lets it go, so "in flight" lasts exactly as long as the assertion needs.
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/__scrivania/save', async (route) => {
    await gate;
    await route.fallback();
  });

  const saveButton = page.getByRole('button', { name: 'Salva', exact: true });
  // The save still completes after the assertion: wait for its reload so it cannot overlap the next spec.
  const reloaded = page.waitForEvent('load');
  await saveButton.click();
  await expect(saveButton).toBeDisabled();
  release();
  await reloaded;
});
