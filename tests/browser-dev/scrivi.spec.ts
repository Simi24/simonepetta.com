import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { saveAndReload, spine, uniqueTitle } from './desk.ts';

// The one flow that exists only under `astro dev` (SPEC.md §6.4): everything else about the
// writing desk is covered at the `save.ts` unit seam and the build-output seam.
test('adding a book from the shelf menu shows it on the shelf, without restarting the dev server', async ({ page }, testInfo) => {
  const titolo = uniqueTitle('Il fu Mattia Pascal', testInfo);
  await page.goto('/scrivi/');
  await expect(page.getByRole('button', { name: '+ aggiungi' })).toBeVisible();

  await page.getByRole('button', { name: '+ aggiungi' }).click();
  await page.locator('#nf-t').fill(titolo);
  await page.locator('#nf-a').fill('Luigi Pirandello');
  await saveAndReload(page, page.getByRole('button', { name: 'Inizia a leggerlo' }));

  await expect(spine(page, titolo)).toBeVisible();
});

test('editing an entry whose file has a hand-made name edits that file, not a new one', async ({ page }, testInfo) => {
  const titolo = uniqueTitle('Nome Fatto A Mano', testInfo);
  const contentDir = process.env['LETTURE_CONTENT_DIR'] ?? '';
  const file = `${titolo}.md`;
  writeFileSync(
    join(contentDir, file),
    `---\ntitolo: "${titolo}"\nautore: "Autore di Prova"\nstato: in-corso\niniziato: "2026-09-01"\n---\n`,
  );
  const before = readdirSync(contentDir).sort();

  await page.goto('/scrivi/');
  await spine(page, titolo).click();
  await page.getByRole('button', { name: 'Modifica', exact: true }).click();
  await page.locator('#em-a').fill('Un Altro Autore');
  await saveAndReload(page, page.getByRole('button', { name: 'Salva', exact: true }));

  expect(readdirSync(contentDir).sort()).toEqual(before);
  expect(readFileSync(join(contentDir, file), 'utf8')).toContain('autore: "Un Altro Autore"');
});

test('a save shows the saved view: the file, what is in it and how to publish, then back to the shelf', async ({ page }, testInfo) => {
  const titolo = uniqueTitle('Libro per la vista salvata', testInfo);
  await page.goto('/scrivi/');
  await page.getByRole('button', { name: '+ aggiungi' }).click();
  await page.locator('#nf-t').fill(titolo);
  await page.locator('#nf-a').fill('Autore di Prova');
  await page.getByRole('button', { name: 'Inizia a leggerlo' }).click();

  await expect(page.getByRole('heading', { name: 'Sul comodino.' })).toBeVisible();
  await expect(page.locator('.path')).toHaveText(/\.md$/);
  await expect(page.locator('.file')).toContainText(`titolo: "${titolo}"`);
  await expect(page.locator('.steps')).toContainText('git commit -am "letture: …"');
  await expect(page.locator('.steps')).toContainText('Il deploy parte da solo.');
  await expect(page.locator('.shelf')).toBeHidden();

  await page.getByRole('button', { name: 'Torna alla mensola' }).click();
  await expect(spine(page, titolo)).toBeVisible();
});
