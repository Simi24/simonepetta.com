import { expect, test } from '@playwright/test';

// The writing sheet (SPEC.md §6.4) exists only under `astro dev`: this is the seam for the timer
// *starting*, the outline, the preview and the unsaved-text guard. The countdown's own tick-by-tick
// arithmetic and its "reaches zero" behavior are unit-tested with a fake clock in
// scrivania-timer.test.ts — not repeated here with a real (or browser-faked) 20-minute wait.

async function addBook(page: import('@playwright/test').Page, titolo: string): Promise<void> {
  await page.goto('/scrivi/');
  await page.getByRole('button', { name: '+ aggiungi' }).click();
  await page.locator('#nf-t').fill(titolo);
  await page.locator('#nf-a').fill('Autore di Prova');
  await Promise.all([page.waitForURL('**/scrivi/'), page.getByRole('button', { name: 'Inizia a leggerlo' }).click()]);
}

test('the timer starts at the first keystroke and never locks the sheet', async ({ page }) => {
  await addBook(page, 'Il timer della scrivania');
  await page.getByRole('button', { name: /Il timer della scrivania/ }).click();
  await page.getByRole('button', { name: "L'ho finito, scrivo" }).click();

  await expect(page.locator('.clock')).toHaveText('20:00');
  await expect(page.locator('.clock-note')).toHaveText('Parte quando inizi a scrivere.');

  await page.locator('#dk-text').fill('Una prima parola');
  await expect(page.locator('.clock-note')).toHaveText('Una passata sola, senza tornare indietro.');
  await expect(page.locator('.clock')).toHaveText('19:59');
  // The sheet must stay fully usable even mid-timer: never disabled.
  await expect(page.locator('#dk-text')).toBeEnabled();
});

test('the timer does not run while editing an existing text', async ({ page }) => {
  await addBook(page, 'Il timer non riparte');
  await page.getByRole('button', { name: /Il timer non riparte/ }).click();
  await page.getByRole('button', { name: "L'ho finito, senza testo" }).click();
  await page.getByRole('button', { name: 'Voto 4', exact: true }).click();
  await Promise.all([page.waitForURL('**/scrivi/'), page.getByRole('button', { name: 'Salva' }).click()]);

  await page.getByRole('button', { name: /Il timer non riparte/ }).click();
  await page.getByRole('button', { name: 'Scrivi il testo' }).click();
  await page.locator('#dk-text').fill('Testo scritto una prima volta.');
  await Promise.all([page.waitForURL('**/scrivi/'), page.getByRole('button', { name: 'Salva' }).click()]);

  await page.getByRole('button', { name: /Il timer non riparte/ }).click();
  await page.getByRole('button', { name: 'Modifica' }).click();
  await expect(page.locator('.clock')).toBeHidden();
  await page.locator('#dk-text').fill('Testo scritto una prima volta. Aggiunta.');
  await expect(page.locator('.clock')).toBeHidden();
});

test('clicking an outline question inserts it as a `##` heading', async ({ page }) => {
  await addBook(page, 'La traccia opzionale');
  await page.getByRole('button', { name: /La traccia opzionale/ }).click();
  await page.getByRole('button', { name: "L'ho finito, scrivo" }).click();

  await page.getByRole('button', { name: 'A cosa si collega' }).click();
  await expect(page.locator('#dk-text')).toHaveValue('## A cosa si collega\n\n');
});

test('grades are selectable in half points from 1 to 5', async ({ page }) => {
  await addBook(page, 'Il voto a metà punto');
  await page.getByRole('button', { name: /Il voto a metà punto/ }).click();
  await page.getByRole('button', { name: "L'ho finito, scrivo" }).click();

  const halfBetween3And4 = page.getByRole('button', { name: 'Voto 3,5' });
  await halfBetween3And4.click();
  await expect(halfBetween3And4).toHaveAttribute('aria-pressed', 'true');
});

test('the preview renders the real post component, not a copy of its markup', async ({ page }) => {
  await addBook(page, 'Il diario di un lettore qualunque');
  await page.getByRole('button', { name: /Il diario di un lettore qualunque/ }).click();
  await page.getByRole('button', { name: "L'ho finito, scrivo" }).click();
  await page.locator('#dk-text').fill('## A cosa si collega\n\nUna reazione sincera al libro.');

  await page.getByRole('button', { name: 'Anteprima' }).click();
  await expect(page.locator('.post .post-head h1')).toHaveText('Il diario di un lettore qualunque');
  await expect(page.locator('.post .prose h2')).toHaveText('A cosa si collega');
  await expect(page.locator('.post .prose p')).toHaveText('Una reazione sincera al libro.');

  await page.getByRole('button', { name: 'Torna a scrivere' }).click();
  await expect(page.locator('#dk-text')).toBeVisible();
});

test('finishing with a text produces a valid entry that carries over to the post', async ({ page }) => {
  await addBook(page, 'Finito con testo');
  await page.getByRole('button', { name: /Finito con testo/ }).click();
  await page.getByRole('button', { name: "L'ho finito, scrivo" }).click();
  await page.locator('#dk-text').fill('La mia reazione al libro.');
  await page.getByRole('button', { name: 'Voto 4', exact: true }).click();
  await Promise.all([page.waitForURL('**/scrivi/'), page.getByRole('button', { name: 'Salva' }).click()]);

  await page.getByRole('button', { name: /Finito con testo/ }).click();
  await expect(page.getByRole('button', { name: 'Modifica' })).toBeVisible();
});

test('finishing without a text produces a valid entry, with no textarea offered again until asked for', async ({ page }) => {
  await addBook(page, 'Finito senza testo');
  await page.getByRole('button', { name: /Finito senza testo/ }).click();
  await page.getByRole('button', { name: "L'ho finito, senza testo" }).click();
  await page.getByRole('button', { name: 'Voto 3', exact: true }).click();
  await Promise.all([page.waitForURL('**/scrivi/'), page.getByRole('button', { name: 'Salva' }).click()]);

  await page.getByRole('button', { name: /Finito senza testo/ }).click();
  await expect(page.getByRole('button', { name: 'Scrivi il testo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Modifica voto e dati' })).toBeVisible();
});

test('abandoning with a one-line note produces a valid entry', async ({ page }) => {
  await addBook(page, 'Abbandonato a metà');
  await page.getByRole('button', { name: /Abbandonato a metà/ }).click();
  await page.getByRole('button', { name: "L'ho lasciato a metà" }).click();
  await page.locator('#df-n').fill('a pagina 40, non mi convinceva');
  await Promise.all([page.waitForURL('**/scrivi/'), page.getByRole('button', { name: 'Mettilo di traverso' }).click()]);

  await page.getByRole('button', { name: /Abbandonato a metà/ }).click();
  await expect(page.getByRole('button', { name: 'Ricomincia' })).toBeVisible();
});

test('leaving the sheet with unsaved text asks first, and staying keeps the text', async ({ page }) => {
  await addBook(page, 'Il testo non salvato');
  await page.getByRole('button', { name: /Il testo non salvato/ }).click();
  await page.getByRole('button', { name: "L'ho finito, scrivo" }).click();
  await page.locator('#dk-text').fill('Testo che non ho ancora salvato.');

  page.once('dialog', (dialog) => void dialog.dismiss());
  await page.getByRole('button', { name: 'Indietro' }).click();
  await expect(page.locator('#dk-text')).toHaveValue('Testo che non ho ancora salvato.');

  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Indietro' }).click();
  await expect(page.getByRole('button', { name: "L'ho finito, scrivo" })).toBeVisible();
});
