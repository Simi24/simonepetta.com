import { SAVE_PATH } from '../constants.ts';
import type { SavedFile } from '../payload.ts';
import { el } from './dom.ts';

const PENDING_KEY = 'scrivania-saved-heading';

/**
 * The dev server reloads every open page as soon as a save is served, which may be before the
 * save's own response reaches the page that made it. So the saved view is not drawn from that
 * response: the page notes it expects one before saving, and the page that loads next draws it.
 * Per tab (`sessionStorage`), so another tab's reload never shows it.
 */
export function expectSavedView(heading: string): void {
  try {
    sessionStorage.setItem(PENDING_KEY, heading);
  } catch {
    // Storage blocked: the save still works, the shelf just shows without the saved view.
  }
}

export function forgetSavedView(): void {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // Nothing to forget.
  }
}

/** The heading of the saved view this page was loaded to show, if any. */
export function expectedSavedHeading(): string | null {
  try {
    return sessionStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

/** The file the last save wrote, from the dev server. */
export async function fetchLastSaved(): Promise<SavedFile | null> {
  try {
    const res = await fetch(SAVE_PATH);
    return res.ok ? ((await res.json()) as SavedFile) : null;
  } catch {
    return null;
  }
}

/** The saved view (docs/prototype/scrivania.html): where the file is, what is in it, and how to publish it. */
export function buildSavedView(heading: string, saved: SavedFile, onBack: () => void): HTMLElement {
  const wrap = el('div');
  wrap.appendChild(el('h1', undefined, heading));
  wrap.appendChild(el('p', undefined, 'Il file è sul disco, nel repo del sito:'));
  wrap.appendChild(el('p', 'path', saved.path));
  wrap.appendChild(el('div', 'file', saved.contents));

  const steps = el('div', 'steps');
  const hint = el('p', undefined, 'Per pubblicarlo, dal terminale: ');
  hint.append(el('code', undefined, 'git commit -am "letture: …"'), ' e poi push. Il deploy parte da solo.');
  steps.appendChild(hint);
  wrap.appendChild(steps);

  const back = el('button', 'btn', 'Torna alla mensola');
  back.type = 'button';
  back.addEventListener('click', onBack);
  const row = el('p', 'saved-back');
  row.appendChild(back);
  wrap.appendChild(row);
  return wrap;
}
