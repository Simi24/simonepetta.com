import { OUTLINE_PROMPTS, PREVIEW_PATH, TIMER_SECONDS } from '../constants.ts';
import { postPreview } from './api.ts';
import type { DeskBook } from './book.ts';
import { clear, el, today } from './dom.ts';
import { addField, showErrors } from './fields.ts';
import { insertOutlineHeading } from './outline.ts';
import { submitLettura } from './submit.ts';
import { createWritingTimer, formatClock } from './timer.ts';
import { mountVotes } from './votes.ts';

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export interface SheetHandle {
  element: HTMLElement;
  /** True while the textarea differs from the text the sheet opened with (SPEC.md: never lose typed text). */
  hasUnsavedText: () => boolean;
  /** Stops the timer and drops the `beforeunload` listener. The caller runs this once it's safe to leave. */
  teardown: () => void;
}

/**
 * The writing sheet (SPEC.md §6.4): a book already has a text when this opens for "Modifica" — the
 * 20-minute timer only ever runs on a fresh text, never on an edit of one that already exists.
 *
 * Leaving the sheet is entirely the caller's call: `onBack` runs unconditionally on "Indietro", and
 * `hasUnsavedText`/`teardown` are returned so every OTHER way to navigate away (the shelf, "+
 * aggiungi") can be routed through the same guard — the sheet itself has no way to stop the shelf
 * from being clicked out from under it.
 */
export function buildSheet(book: DeskBook, onBack: () => void): SheetHandle {
  const isEditingText = Boolean(book.testo);
  const initialTesto = book.testo ?? '';

  const wrap = el('div', 'sheet');
  const backButton = el('button', 'btn quiet', 'Indietro');
  backButton.type = 'button';
  wrap.appendChild(backButton);

  // ---- header: title/author (+ metadata form when editing an existing text), votes, dates ----
  const head = el('div', 'desk-head');
  const titleBox = el('div', 't');
  titleBox.appendChild(el('h1', undefined, book.titolo));
  titleBox.appendChild(el('p', undefined, book.anno_opera ? `${book.autore}, ${book.anno_opera}` : book.autore));

  let metaFields: { titolo: HTMLInputElement; autore: HTMLInputElement; anno: HTMLInputElement } | null = null;
  if (isEditingText) {
    const metaForm = el('div', 'form');
    const titolo = addField(metaForm, 'Titolo', 'dk-t', book.titolo, { span: 2, required: true });
    const autore = addField(metaForm, 'Autore', 'dk-a', book.autore, { span: 2, required: true });
    const anno = addField(metaForm, 'Anno', 'dk-y', book.anno_opera?.toString() ?? '', { numeric: true });
    titleBox.appendChild(metaForm);
    metaFields = { titolo, autore, anno };
  }
  head.appendChild(titleBox);

  const v = el('div', 'v');
  v.appendChild(el('div', 'muted', 'Voto'));
  const votesBox = el('div', 'votes');
  v.appendChild(votesBox);
  const getVoto = mountVotes(votesBox, book.voto);
  const datesBox = el('div', 'dates');
  const iniziatoLabel = el('label', undefined, 'Iniziato ');
  const iniziatoInput = document.createElement('input');
  iniziatoInput.type = 'date';
  iniziatoInput.id = 'dk-start';
  // The prototype only defaults `finito` to today; `iniziato` stays empty rather than inventing a
  // date the author never set (e.g. a `letto` book whose file never carried one).
  iniziatoInput.value = book.iniziato ?? '';
  iniziatoLabel.appendChild(iniziatoInput);
  const finitoLabel = el('label', undefined, 'Finito ');
  const finitoInput = document.createElement('input');
  finitoInput.type = 'date';
  finitoInput.id = 'dk-end';
  finitoInput.value = book.finito ?? today();
  finitoLabel.appendChild(finitoInput);
  datesBox.append(iniziatoLabel, finitoLabel);
  v.appendChild(datesBox);
  head.appendChild(v);
  wrap.appendChild(head);

  // ---- desk: the paper and the side panel ----
  const desk = el('div', 'desk');
  const paper = el('div', 'paper');
  const textarea = document.createElement('textarea');
  textarea.id = 'dk-text';
  textarea.setAttribute('aria-label', 'La tua reazione');
  textarea.placeholder = 'Scrivi come se nessuno leggesse. Una passata, poi salvi.';
  textarea.value = initialTesto;
  paper.appendChild(textarea);

  const side = el('aside', 'side');
  const clockWrap = el('div');
  clockWrap.hidden = isEditingText; // SPEC.md §6.4: the timer does not run while editing an existing text
  const clockEl = el('div', 'clock', formatClock(TIMER_SECONDS));
  const clockNote = el('div', 'clock-note', 'Parte quando inizi a scrivere.');
  clockWrap.append(clockEl, clockNote);
  const wordsWrap = el('div', 'words');
  const wordsCount = el('b', undefined, String(countWords(initialTesto)));
  wordsWrap.append(wordsCount, document.createTextNode(' '), el('span', 'muted', 'parole, intorno a 250'));
  const promptsBox = el('div');
  promptsBox.appendChild(el('h2', undefined, 'Se ti serve una traccia'));
  const promptsList = el('ol', 'prompts');
  for (const prompt of OUTLINE_PROMPTS) {
    const li = el('li');
    const button = el('button', undefined, prompt);
    button.type = 'button';
    button.addEventListener('click', () => {
      textarea.value = insertOutlineHeading(textarea.value, prompt);
      textarea.focus();
      textarea.dispatchEvent(new Event('input'));
    });
    li.appendChild(button);
    promptsList.appendChild(li);
  }
  promptsBox.appendChild(promptsList);
  promptsBox.appendChild(el('p', 'muted', 'Clic per usarla come titolo. Non sei obbligato.'));
  side.append(clockWrap, wordsWrap, promptsBox);
  desk.append(paper, side);
  wrap.appendChild(desk);

  // ---- preview pane (hidden until asked for) ----
  const previewCaption = el('p', 'muted', `Anteprima: così appare su simonepetta.com/letture/${book.slug}/`);
  const previewPane = el('div');
  const preview = el('div');
  preview.append(previewCaption, previewPane);
  preview.hidden = true;
  wrap.appendChild(preview);

  // ---- bottom bar ----
  const errors = el('div', 'errors');
  const bar = el('div', 'bar');
  const barIn = el('div', 'bar-in');
  const previewButton = el('button', 'btn', 'Anteprima');
  previewButton.type = 'button';
  const editBackButton = el('button', 'btn', 'Torna a scrivere');
  editBackButton.type = 'button';
  editBackButton.hidden = true;
  const saveButton = el('button', 'btn solid', 'Salva');
  saveButton.type = 'button';
  barIn.append(previewButton, editBackButton, saveButton);
  bar.appendChild(barIn);
  wrap.append(errors, bar);

  // ---- timer: starts at the first keystroke, only on a fresh text (SPEC.md §6.4) ----
  let started = false;
  const timer = createWritingTimer(
    (secondsLeft) => {
      clockEl.textContent = formatClock(secondsLeft);
    },
    () => {
      clockNote.textContent = 'Venti minuti. Se hai detto quello che volevi, salva così com’è.';
    },
  );
  textarea.addEventListener('input', () => {
    wordsCount.textContent = String(countWords(textarea.value));
    if (!isEditingText && !started) {
      started = true;
      clockNote.textContent = 'Una passata sola, senza tornare indietro.';
      timer.start();
    }
  });

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
    timer.stop();
    window.removeEventListener('beforeunload', onBeforeUnload);
  }

  // `onBack` is the caller's own guarded navigation (it decides whether to confirm and to call
  // `teardown` — see `SheetHandle`): "Indietro" just asks for it, like any other way out.
  backButton.addEventListener('click', onBack);

  function collectData(): Record<string, unknown> {
    return {
      titolo: metaFields ? metaFields.titolo.value.trim() || book.titolo : book.titolo,
      autore: metaFields ? metaFields.autore.value.trim() || book.autore : book.autore,
      anno_opera: metaFields
        ? metaFields.anno.value
          ? Number(metaFields.anno.value)
          : undefined
        : (book.anno_opera ?? undefined),
      stato: 'letto',
      pagine: book.pagine ?? undefined,
      iniziato: iniziatoInput.value || undefined,
      finito: finitoInput.value || undefined,
      voto: getVoto() ?? undefined,
      // Not edited here, but must survive a sheet save all the same (SPEC.md: never lose data the
      // author didn't touch).
      nota: book.nota ?? undefined,
    };
  }

  previewButton.addEventListener('click', () => {
    void (async () => {
      clear(errors);
      const result = await postPreview(PREVIEW_PATH, { data: collectData(), testo: textarea.value });
      if (!result.ok) {
        showErrors(errors, result.issues);
        return;
      }
      previewPane.innerHTML = result.html;
      desk.hidden = true;
      preview.hidden = false;
      previewButton.hidden = true;
      editBackButton.hidden = false;
    })();
  });

  editBackButton.addEventListener('click', () => {
    preview.hidden = true;
    desk.hidden = false;
    previewButton.hidden = false;
    editBackButton.hidden = true;
  });

  saveButton.addEventListener('click', () => {
    saveButton.disabled = true;
    void submitLettura(book.slug, collectData(), errors, textarea.value, teardown, book.version ?? undefined).finally(() => {
      saveButton.disabled = false; // harmless on success too: the page navigates away right after
    });
  });

  return { element: wrap, hasUnsavedText, teardown };
}
