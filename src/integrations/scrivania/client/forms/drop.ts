import type { DeskBook } from '../book.ts';
import { el, today } from '../dom.ts';
import { addField, addSubmit } from '../fields.ts';
import { carriedData, editPayload } from '../payload.ts';
import { submitLettura } from '../submit.ts';
import { backButton } from './back-button.ts';

/** "L'ho lasciato a metà": the book becomes `abbandonato`, with one line on where and why. */
export function buildDropForm(book: DeskBook, onBack: () => void): HTMLElement {
  const wrap = el('div');
  wrap.appendChild(backButton(onBack));
  wrap.appendChild(el('h2', undefined, 'Lasciato a metà'));
  const form = el('form', 'form');
  const nota = addField(form, "Dove l'hai lasciato, e perché (una riga basta)", 'df-n', '', {
    span: 2,
    required: true,
    placeholder: 'Per esempio: a pagina 60, non mi prendeva',
  });
  const data = addField(form, 'Il', 'df-d', today(), { type: 'date' });
  addSubmit(form, 'Mettilo di traverso');
  const errors = el('div', 'errors');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const payload = {
      ...carriedData(book),
      stato: 'abbandonato',
      iniziato: book.iniziato ?? undefined,
      finito: data.value || today(),
      nota: nota.value.trim(),
    };
    void submitLettura({ payload: editPayload(book, payload), heading: 'Messo di traverso.', errorsBox: errors });
  });
  wrap.append(form, errors);
  return wrap;
}
