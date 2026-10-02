import type { DeskBook } from '../book.ts';
import { el, today } from '../dom.ts';
import { addField, addSubmit } from '../fields.ts';
import { carriedData, editPayload } from '../payload.ts';
import { submitLettura } from '../submit.ts';
import { addVotesField } from '../votes.ts';
import { backButton } from './back-button.ts';

/** "Modifica": every metadata field of an existing book, never its text. */
export function buildEditForm(book: DeskBook, onBack: () => void): HTMLElement {
  const wrap = el('div');
  wrap.appendChild(backButton(onBack));
  wrap.appendChild(el('h2', undefined, 'Modifica'));
  const form = el('form', 'form');

  const titolo = addField(form, 'Titolo', 'em-t', book.titolo, { span: 2, required: true });
  const autore = addField(form, 'Autore', 'em-a', book.autore, { span: 2, required: true });
  const anno = addField(form, "Anno dell'opera", 'em-y', book.anno_opera?.toString() ?? '', { numeric: true });
  const iniziato = addField(form, 'Iniziato il', 'em-s', book.iniziato ?? '', { type: 'date' });

  const finito =
    book.stato !== 'in-corso'
      ? addField(form, book.stato === 'abbandonato' ? 'Lasciato il' : 'Finito il', 'em-f', book.finito ?? today(), {
          type: 'date',
          required: book.stato === 'letto',
        })
      : null;

  const nota =
    book.stato === 'abbandonato' ? addField(form, "Nota sull'abbandono", 'em-n', book.nota ?? '', { span: 4 }) : null;

  const getVoto = book.stato !== 'in-corso' ? addVotesField(form, book.voto) : null;

  addSubmit(form, 'Salva');
  const errors = el('div', 'errors');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      ...carriedData(book),
      titolo: titolo.value.trim(),
      autore: autore.value.trim(),
      stato: book.stato,
      anno_opera: anno.value ? Number(anno.value) : undefined,
      iniziato: iniziato.value || undefined,
      finito: finito?.value || undefined,
      voto: getVoto?.() ?? undefined,
      nota: nota?.value.trim() || undefined,
    };
    void submitLettura({ payload: editPayload(book, data), heading: 'Modificato.', errorsBox: errors });
  });

  wrap.append(form, errors);
  return wrap;
}
