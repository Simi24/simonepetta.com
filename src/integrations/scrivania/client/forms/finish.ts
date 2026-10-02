import type { DeskBook } from '../book.ts';
import { el, today } from '../dom.ts';
import { addField, addSubmit } from '../fields.ts';
import { carriedData, editPayload } from '../payload.ts';
import { submitLettura } from '../submit.ts';
import { addVotesField } from '../votes.ts';
import { backButton } from './back-button.ts';

/** "L'ho finito, senza testo": the book becomes `letto` with a date and a grade, and no text. */
export function buildFinishForm(book: DeskBook, onBack: () => void): HTMLElement {
  const wrap = el('div');
  wrap.appendChild(backButton(onBack));
  wrap.appendChild(el('h2', undefined, 'Finito, senza testo'));
  const form = el('form', 'form');
  const finito = addField(form, 'Finito il', 'ff-d', book.finito ?? today(), { type: 'date', required: true });
  const getVoto = addVotesField(form, book.voto);
  addSubmit(form, 'Salva');
  const errors = el('div', 'errors');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      ...carriedData(book),
      stato: 'letto',
      iniziato: book.iniziato ?? undefined,
      finito: finito.value || today(),
      voto: getVoto() ?? undefined,
    };
    void submitLettura({ payload: editPayload(book, data), heading: 'Salvato.', errorsBox: errors });
  });
  wrap.append(form, errors);
  return wrap;
}
