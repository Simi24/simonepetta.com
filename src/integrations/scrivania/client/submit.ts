import { SAVE_PATH } from '../constants.ts';
import type { SavePayload } from '../payload.ts';
import { postSave } from './api.ts';
import { clear } from './dom.ts';
import { showErrors } from './fields.ts';
import { expectSavedView, forgetSavedView } from './saved-view.ts';

export interface SubmitOptions {
  payload: SavePayload;
  /** The saved view's heading (docs/prototype/scrivania.html): "Salvato.", "Modificato.", … */
  heading: string;
  errorsBox: HTMLElement;
  /** Runs once the save succeeded, before the page moves on (e.g. to drop an unsaved-text guard). */
  onSaved?: () => void;
}

/**
 * Posts a book's data to the save endpoint (SPEC.md §6.4); on success loads the saved view, after
 * `onSaved` runs. A response `warning` (the file was written, but refreshing the content
 * collection failed) is surfaced before that, rather than silently dropped. On failure —
 * including a stale `expectedVersion` conflict — shows the per-field issues in `errorsBox` and
 * stays put.
 */
export async function submitLettura({ payload, heading, errorsBox, onSaved }: SubmitOptions): Promise<void> {
  clear(errorsBox);
  const saveId = expectSavedView(heading);
  const result = await postSave(SAVE_PATH, { ...payload, saveId });
  if (result.ok) {
    if (result.warning) window.alert(result.warning);
    onSaved?.();
    location.assign('/scrivi/'); // trailingSlash: 'always' (astro.config.mjs)
    return;
  }
  forgetSavedView();
  showErrors(errorsBox, result.issues);
}
