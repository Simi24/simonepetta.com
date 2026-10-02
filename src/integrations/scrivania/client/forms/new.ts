import { el, today } from '../dom.ts';
import { addField, addSubmit } from '../fields.ts';
import { submitLettura } from '../submit.ts';

/** "+ aggiungi": a new book, `in-corso` from today. */
export function buildNewForm(): HTMLElement {
  const wrap = el('div');
  wrap.appendChild(el('h2', undefined, 'Nuovo libro sul comodino'));
  const form = el('form', 'form');
  const titolo = addField(form, 'Titolo', 'nf-t', '', { span: 2, required: true });
  const autore = addField(form, 'Autore', 'nf-a', '', { span: 2, required: true });
  const anno = addField(form, "Anno dell'opera", 'nf-y', '', { numeric: true });
  const pagine = addField(form, 'Pagine', 'nf-p', '', { numeric: true });
  const iniziato = addField(form, 'Iniziato il', 'nf-s', today(), { type: 'date', span: 2 });
  addSubmit(form, 'Inizia a leggerlo');
  const errors = el('div', 'errors');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      titolo: titolo.value.trim(),
      autore: autore.value.trim(),
      stato: 'in-corso',
      anno_opera: anno.value ? Number(anno.value) : undefined,
      pagine: pagine.value ? Number(pagine.value) : undefined,
      iniziato: iniziato.value || today(),
    };
    void submitLettura({ payload: { data }, heading: 'Sul comodino.', errorsBox: errors });
  });
  wrap.append(form, errors);
  return wrap;
}
