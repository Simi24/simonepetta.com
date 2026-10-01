import { expect, saveAndReload, spine, test, uniqueTitle } from './desk.ts';

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
