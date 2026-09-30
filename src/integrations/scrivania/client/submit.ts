import { SAVE_PATH } from '../constants.ts';
import { postSave } from './api.ts';
import { clear } from './dom.ts';
import { showErrors } from './fields.ts';

/**
 * Posts a book's data to the save endpoint (SPEC.md §6.4); on success navigates back to the
 * shelf, after `onSaved` runs (e.g. to drop an unsaved-text guard before that navigation starts).
 * A response `warning` (the file was written, but refreshing the content collection failed) is
 * surfaced before navigating, rather than silently dropped. On failure — including a stale
 * `expectedVersion` conflict — shows the per-field issues in `errorsBox` and stays put.
 */
export async function submitLettura(
  slug: string | undefined,
  data: Record<string, unknown>,
  errorsBox: HTMLElement,
  testo?: string,
  onSaved?: () => void,
  expectedVersion?: string,
): Promise<void> {
  clear(errorsBox);
  const result = await postSave(SAVE_PATH, { slug, data, testo, expectedVersion });
  if (result.ok) {
    if (result.warning) window.alert(result.warning);
    onSaved?.();
    location.assign('/scrivi/'); // trailingSlash: 'always' (astro.config.mjs)
    return;
  }
  showErrors(errorsBox, result.issues);
}
