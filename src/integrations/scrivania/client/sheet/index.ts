import { PREVIEW_PATH } from '../../constants.ts';
import { postPreview } from '../api.ts';
import type { DeskBook } from '../book.ts';
import { clear, el } from '../dom.ts';
import { showErrors } from '../fields.ts';
import { carriedData, sheetPayload } from '../payload.ts';
import { submitLettura } from '../submit.ts';
import { buildSheetBar } from './bar.ts';
import { buildSheetDesk } from './desk.ts';
import { buildSheetHeader } from './header.ts';
import { buildSheetPreview } from './preview.ts';

export interface SheetHandle {
  element: HTMLElement;
  /** True while the textarea differs from the text the sheet opened with (SPEC.md: never lose typed text). */
  hasUnsavedText: () => boolean;
  /** Stops the timer and drops the `beforeunload` listener. The caller runs this once it's safe to leave. */
  teardown: () => void;
}

const NOTE_NEW = 'Il testo è opzionale: anche solo il voto va bene.';
const NOTE_EDIT = "Modifica: il timer serve solo alla prima passata. L'indirizzo della pagina non cambia.";

/**
 * The writing sheet (SPEC.md §6.4): a book already has a text when this opens for "Modifica" — the
 * 20-minute timer only ever runs on a fresh text, never on an edit of one that already exists.
 *
 * Leaving the sheet is entirely the caller's call: `onBack` runs unconditionally on "Mensola", and
 * `hasUnsavedText`/`teardown` are returned so every OTHER way to navigate away (the shelf, "+
 * aggiungi") can be routed through the same guard — the sheet itself has no way to stop the shelf
 * from being clicked out from under it.
 */
export function buildSheet(book: DeskBook, onBack: () => void): SheetHandle {
  const isEditingText = Boolean(book.testo);
  const initialTesto = book.testo ?? '';

  const header = buildSheetHeader(book, isEditingText);
  const desk = buildSheetDesk(initialTesto, isEditingText);
  const preview = buildSheetPreview(book.slug);
  const errors = el('div', 'errors');
  const bar = buildSheetBar(isEditingText ? NOTE_EDIT : NOTE_NEW);
  const wrap = el('div', 'sheet');
  wrap.append(header.element, desk.element, preview.element, errors, bar.element);
  const { textarea } = desk;

  // ---- the unsaved-text guard (SPEC.md: never lose typed text) ----
  function hasUnsavedText(): boolean {
    return textarea.value.trim() !== initialTesto.trim();
  }
  function onBeforeUnload(event: BeforeUnloadEvent): void {
    if (!hasUnsavedText()) return;
    event.preventDefault();
    event.returnValue = '';
  }
  window.addEventListener('beforeunload', onBeforeUnload);
  function teardown(): void {
    desk.stop();
    window.removeEventListener('beforeunload', onBeforeUnload);
  }

  // `onBack` is the caller's own guarded navigation (it decides whether to confirm and to call
  // `teardown` — see `SheetHandle`): "Mensola" just asks for it, like any other way out.
  bar.onBack(onBack);

  function collectData(): Record<string, unknown> {
    const { titolo, autore, anno_opera, voto, iniziato, finito } = header.read();
    return {
      ...carriedData(book),
      titolo,
      autore,
      anno_opera,
      stato: 'letto',
      iniziato,
      finito,
      voto,
      // Not edited here, but must survive a sheet save all the same (SPEC.md: never lose data the
      // author didn't touch).
      nota: book.nota ?? undefined,
    };
  }

  bar.onPreview(() => {
    void (async () => {
      clear(errors);
      const result = await postPreview(PREVIEW_PATH, { data: collectData(), testo: textarea.value });
      if (!result.ok) {
        showErrors(errors, result.issues);
        return;
      }
      preview.show(result.html, textarea.value.trim() !== '');
      desk.element.hidden = true;
      bar.setPreviewing(true);
    })();
  });

  bar.onEdit(() => {
    preview.hide();
    desk.element.hidden = false;
    bar.setPreviewing(false);
  });

  bar.onSave(() => {
    bar.setSaving(true);
    void submitLettura({
      payload: sheetPayload(book, collectData(), textarea.value),
      heading: isEditingText ? 'Modificato.' : 'Salvato.',
      errorsBox: errors,
      onSaved: teardown,
    }).finally(() => {
      bar.setSaving(false); // harmless on success too: the page navigates away right after
    });
  });

  return { element: wrap, hasUnsavedText, teardown };
}
