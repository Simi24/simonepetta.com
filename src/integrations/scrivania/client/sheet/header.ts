import type { DeskBook } from '../book.ts';
import { el, today } from '../dom.ts';
import { addField } from '../fields.ts';
import { mountVotes } from '../votes.ts';

export interface SheetHeader {
  element: HTMLElement;
  /** What the header's inputs hold now. Title, author and year are the book's own unless the sheet edits an existing text. */
  read: () => { titolo: string; autore: string; anno_opera: number | undefined; voto: number | undefined; iniziato: string | undefined; finito: string | undefined };
}

function dateField(labelText: string, id: string, value: string): { label: HTMLLabelElement; input: HTMLInputElement } {
  const label = el('label', undefined, `${labelText} `);
  const input = document.createElement('input');
  input.type = 'date';
  input.id = id;
  input.value = value;
  label.appendChild(input);
  return { label, input };
}

/** Title and author (editable when the book already has a text), the grade picker and the two dates. */
export function buildSheetHeader(book: DeskBook, isEditingText: boolean): SheetHeader {
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
  // The prototype only defaults `finito` to today; `iniziato` stays empty rather than inventing a
  // date the author never set (e.g. a `letto` book whose file never carried one).
  const iniziato = dateField('Iniziato', 'dk-start', book.iniziato ?? '');
  const finito = dateField('Finito', 'dk-end', book.finito ?? today());
  const datesBox = el('div', 'dates');
  datesBox.append(iniziato.label, finito.label);
  v.appendChild(datesBox);
  head.appendChild(v);

  return {
    element: head,
    read: () => ({
      titolo: metaFields ? metaFields.titolo.value.trim() || book.titolo : book.titolo,
      autore: metaFields ? metaFields.autore.value.trim() || book.autore : book.autore,
      anno_opera: metaFields ? (metaFields.anno.value ? Number(metaFields.anno.value) : undefined) : (book.anno_opera ?? undefined),
      voto: getVoto() ?? undefined,
      iniziato: iniziato.input.value || undefined,
      finito: finito.input.value || undefined,
    }),
  };
}
