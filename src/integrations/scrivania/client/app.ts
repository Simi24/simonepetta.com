import type { DeskBook, DeskData } from './book.ts';
import { clear } from './dom.ts';
import { buildActions, type Activity } from './forms/actions.ts';
import { buildDropForm } from './forms/drop.ts';
import { buildEditForm } from './forms/edit.ts';
import { buildFinishForm } from './forms/finish.ts';
import { buildNewForm } from './forms/new.ts';
import { buildSavedView, expectedSavedHeading, fetchLastSaved, forgetSavedView } from './saved-view.ts';
import { renderShelf, type Selection } from './shelf.ts';
import { buildSheet } from './sheet/index.ts';

function readDeskData(): DeskData {
  const node = document.getElementById('scrivania-data');
  if (!node?.textContent) throw new Error('dati della scrivania mancanti');
  return JSON.parse(node.textContent) as DeskData;
}

/** Shows the file the last save wrote instead of the shelf, when this page was loaded by a save. */
async function showSavedView(homeEl: HTMLElement, savedEl: HTMLElement, heading: string): Promise<void> {
  const saved = await fetchLastSaved();
  if (saved === null) {
    forgetSavedView();
    return;
  }
  savedEl.appendChild(
    buildSavedView(heading, saved, () => {
      forgetSavedView();
      clear(savedEl);
      savedEl.hidden = true;
      homeEl.hidden = false;
    }),
  );
  homeEl.hidden = true;
  savedEl.hidden = false;
}

/** Wires up `/scrivi`: the shelf as a menu, its per-state actions, and the save round-trip (SPEC.md §6.4). */
export function initScrivania(): void {
  const { books } = readDeskData();
  const homeEl = document.getElementById('scrivania-home');
  const shelfEl = document.getElementById('scrivania-shelf');
  const panelEl = document.getElementById('scrivania-panel');
  const savedEl = document.getElementById('scrivania-saved');
  if (!homeEl || !shelfEl || !panelEl || !savedEl) return;

  let selection: Selection | null = null;
  let activity: Activity | null = null;
  // Set only while the writing sheet (SPEC.md §6.4) is open, so every way of navigating away from
  // it — the shelf, "+ aggiungi", or the sheet's own "Mensola" — goes through the same guard.
  let openSheet: { hasUnsavedText: () => boolean; teardown: () => void } | null = null;

  /** Runs `action` unless the open sheet has unsaved text and the author cancels leaving it. */
  function attemptNavigate(action: () => void): void {
    if (openSheet) {
      if (openSheet.hasUnsavedText() && !window.confirm('Hai del testo non salvato. Uscire comunque?')) return;
      openSheet.teardown();
      openSheet = null;
    }
    action();
  }

  function select(next: Selection | null): void {
    selection = next;
    activity = null;
    drawShelf();
    renderPanel();
  }

  function setActivity(next: Activity | null): void {
    activity = next;
    renderPanel();
  }

  function bookFor(slug: string): DeskBook {
    const book = books.find((b) => b.slug === slug);
    if (!book) throw new Error(`libro sconosciuto: ${slug}`);
    return book;
  }

  function drawShelf(): void {
    renderShelf(shelfEl!, books, selection, { onSelect: (next) => attemptNavigate(() => select(next)) });
  }

  function renderPanel(): void {
    clear(panelEl!);
    if (!selection) {
      panelEl!.hidden = true;
      return;
    }
    panelEl!.hidden = false;
    if (selection.type === 'new') {
      panelEl!.appendChild(buildNewForm());
      return;
    }
    const book = bookFor(selection.slug);
    const back = (): void => setActivity(null);
    if (activity === 'edit') panelEl!.appendChild(buildEditForm(book, back));
    else if (activity === 'finish') panelEl!.appendChild(buildFinishForm(book, back));
    else if (activity === 'drop') panelEl!.appendChild(buildDropForm(book, back));
    else if (activity === 'write') {
      const sheet = buildSheet(book, () => attemptNavigate(back));
      openSheet = sheet;
      panelEl!.appendChild(sheet.element);
    } else panelEl!.appendChild(buildActions(book, setActivity));
  }

  drawShelf();
  renderPanel();

  const savedHeading = expectedSavedHeading();
  if (savedHeading !== null) void showSavedView(homeEl, savedEl, savedHeading);
}
