import { expect, test } from '@playwright/test';

// The one flow that exists only under `astro dev` (SPEC.md §6.4): everything else about the
// writing desk is covered at the `save.ts` unit seam and the build-output seam.
test('adding a book from the shelf menu shows it on the shelf, without restarting the dev server', async ({ page }) => {
  await page.goto('/scrivi/');
  await expect(page.getByRole('button', { name: '+ aggiungi' })).toBeVisible();

  await page.getByRole('button', { name: '+ aggiungi' }).click();
  await page.locator('#nf-t').fill('Il fu Mattia Pascal');
  await page.locator('#nf-a').fill('Luigi Pirandello');
  await Promise.all([page.waitForURL('**/scrivi/'), page.getByRole('button', { name: 'Inizia a leggerlo' }).click()]);

  await expect(page.getByRole('button', { name: /Il fu Mattia Pascal, Luigi Pirandello/ })).toBeVisible();
});
