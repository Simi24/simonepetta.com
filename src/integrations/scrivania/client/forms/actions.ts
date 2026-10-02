import { bookMetaLine } from '../../../../lib/lettura-meta-line.ts';
import type { DeskBook } from '../book.ts';
import { el, today } from '../dom.ts';
import { carriedData, editPayload } from '../payload.ts';
import { submitLettura } from '../submit.ts';

export type Activity = 'edit' | 'finish' | 'drop' | 'write';

/** What a selected book offers, by state (SPEC.md §6.4, labels from docs/prototype/scrivania.html). */
export function buildActions(book: DeskBook, onActivity: (activity: Activity) => void): HTMLElement {
  const wrap = el('div', 'actions');
  const who = el('div', 'who');
  who.appendChild(el('b', undefined, book.titolo));
  who.appendChild(el('span', 'muted', bookMetaLine(book)));
  const doArea = el('div', 'do');
  const errors = el('div', 'errors');

  function addAction(label: string, cls: string, onClick: () => void): void {
    const button = el('button', ['btn', cls].filter(Boolean).join(' '), label);
    button.type = 'button';
    button.addEventListener('click', onClick);
    doArea.appendChild(button);
  }

  if (book.stato === 'in-corso') {
    addAction("L'ho finito, scrivo", 'solid', () => onActivity('write'));
    addAction('Modifica', 'quiet', () => onActivity('edit'));
    addAction("L'ho finito, senza testo", '', () => onActivity('finish'));
    addAction("L'ho lasciato a metà", 'quiet', () => onActivity('drop'));
  } else if (book.stato === 'letto') {
    if (book.testo) {
      addAction('Modifica', 'solid', () => onActivity('write'));
    } else {
      addAction('Scrivi il testo', 'solid', () => onActivity('write'));
      addAction('Modifica voto e dati', 'quiet', () => onActivity('edit'));
    }
  } else {
    addAction('Modifica', '', () => onActivity('edit'));
    addAction('Ricomincialo', '', () => {
      const data = { ...carriedData(book), stato: 'in-corso', iniziato: today() };
      void submitLettura({ payload: editPayload(book, data), heading: 'Salvato.', errorsBox: errors });
    });
  }

  wrap.append(who, doArea, errors);
  return wrap;
}
