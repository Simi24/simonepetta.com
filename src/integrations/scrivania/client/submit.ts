import { SAVE_PATH } from '../constants.ts';
import { postSave } from './api.ts';
import { clear } from './dom.ts';
import { showErrors } from './fields.ts';

/**
 * Posts a book's data to the save endpoint (SPEC.md §6.4); on success navigates back to the
 * shelf, after `onSaved` runs (e.g. to drop an unsaved-text guard before that navigation starts).
 * On failure, shows the per-field issues in `errorsBox` and stays put.
 */
export async function submitLettura(
  slug: string | undefined,
  data: Record<string, unknown>,
  errorsBox: HTMLElement,
  testo?: string,
  onSaved?: () => void,
): Promise<void> {
  clear(errorsBox);
  const result = await postSave(SAVE_PATH, { slug, data, testo });
  if (result.ok) {
    onSaved?.();
    location.assign('/scrivi/'); // trailingSlash: 'always' (astro.config.mjs)
    return;
  }
  showErrors(errorsBox, result.issues);
}
