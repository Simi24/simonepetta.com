import { authorSurname, spineHeightRem, spineWidthRem, tintForSlug, truncateTitle } from '../../../lib/lettura-spine.ts';
import { STATO_PRESENTATION } from '../../../lib/lettura-presentation.ts';
import type { DeskBook, DeskData } from './book.ts';
import { clear, el, today } from './dom.ts';
import { addField, addSubmit } from './fields.ts';
import { metaLine } from './meta.ts';
import { buildSheet } from './sheet.ts';
import { submitLettura } from './submit.ts';
import { addVotesField } from './votes.ts';

type Activity = 'edit' | 'finish' | 'drop' | 'write';
type Selection = { type: 'new' } | { type: 'book'; slug: string };

function readDeskData(): DeskData {
  const node = document.getElementById('scrivania-data');
  if (!node?.textContent) throw new Error('dati della scrivania mancanti');
  return JSON.parse(node.textContent) as DeskData;
}

/** Wires up `/scrivi`: the shelf as a menu, its per-state actions, and the save round-trip (SPEC.md §6.4). */
export function initScrivania(): void {
  const { books } = readDeskData();
  const shelfEl = document.getElementById('scrivania-shelf');
  const panelEl = document.getElementById('scrivania-panel');
  if (!shelfEl || !panelEl) return;

  let selection: Selection | null = null;
  let activity: Activity | null = null;

  function select(next: Selection | null): void {
    selection = next;
    activity = null;
    renderShelf();
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

  function renderShelf(): void {
    clear(shelfEl!);
    for (const book of books) {
      const isSelected = selection?.type === 'book' && selection.slug === book.slug;
      const button = el('button', ['spine', STATO_PRESENTATION[book.stato].spineClass].filter(Boolean).join(' '));
      button.type = 'button';
      button.style.background = `var(--tint-${tintForSlug(book.slug)})`;
      button.style.color = `var(--tint-${tintForSlug(book.slug)}-ink)`;
      button.style.height = `${spineHeightRem(book.pagine ?? undefined)}rem`;
      button.style.width = `${spineWidthRem(book.pagine ?? undefined)}rem`;
      button.appendChild(el('span', undefined, truncateTitle(book.titolo)));
      button.appendChild(el('span', 'spine__author', authorSurname(book.autore)));
      button.setAttribute('aria-label', `${book.titolo}, ${book.autore}`);
      button.setAttribute('aria-pressed', String(isSelected));
      button.addEventListener('click', () => select(isSelected ? null : { type: 'book', slug: book.slug }));
      shelfEl!.appendChild(button);
    }
    const isAdding = selection?.type === 'new';
    const add = el('button', 'spine spine--add', '+ aggiungi');
    add.type = 'button';
    add.setAttribute('aria-pressed', String(isAdding));
    add.addEventListener('click', () => select(isAdding ? null : { type: 'new' }));
    shelfEl!.appendChild(add);
  }

  function backButton(onClick: () => void): HTMLButtonElement {
    const button = el('button', 'btn quiet', 'Indietro');
    button.type = 'button';
    button.addEventListener('click', onClick);
    return button;
  }

  function buildActions(book: DeskBook): HTMLElement {
    const wrap = el('div', 'actions');
    const who = el('div', 'who');
    who.appendChild(el('b', undefined, book.titolo));
    who.appendChild(el('span', 'muted', metaLine(book)));
    const doArea = el('div', 'do');
    const errors = el('div', 'errors');

    function addAction(label: string, cls: string, onClick: () => void): void {
      const button = el('button', ['btn', cls].filter(Boolean).join(' '), label);
      button.type = 'button';
      button.addEventListener('click', onClick);
      doArea.appendChild(button);
    }

    if (book.stato === 'in-corso') {
      addAction("L'ho finito, scrivo", 'solid', () => setActivity('write'));
      addAction('Modifica', 'quiet', () => setActivity('edit'));
      addAction("L'ho finito, senza testo", '', () => setActivity('finish'));
      addAction("L'ho lasciato a metà", 'quiet', () => setActivity('drop'));
    } else if (book.stato === 'letto') {
      if (book.testo) {
        addAction('Modifica', 'solid', () => setActivity('write'));
      } else {
        addAction('Scrivi il testo', 'solid', () => setActivity('write'));
        addAction('Modifica voto e dati', 'quiet', () => setActivity('edit'));
      }
    } else {
      addAction('Modifica', '', () => setActivity('edit'));
      addAction('Ricomincia', '', () => {
        void submitLettura(
          book.slug,
          {
            titolo: book.titolo,
            autore: book.autore,
            anno_opera: book.anno_opera ?? undefined,
            pagine: book.pagine ?? undefined,
            stato: 'in-corso',
            iniziato: today(),
          },
          errors,
        );
      });
    }

    wrap.append(who, doArea, errors);
    return wrap;
  }

  function buildEditForm(book: DeskBook): HTMLElement {
    const wrap = el('div');
    wrap.appendChild(backButton(() => setActivity(null)));
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
      void submitLettura(
        book.slug,
        {
          titolo: titolo.value.trim(),
          autore: autore.value.trim(),
          stato: book.stato,
          pagine: book.pagine ?? undefined,
          anno_opera: anno.value ? Number(anno.value) : undefined,
          iniziato: iniziato.value || undefined,
          finito: finito?.value || undefined,
          voto: getVoto?.() ?? undefined,
          nota: nota?.value.trim() || undefined,
        },
        errors,
      );
    });

    wrap.append(form, errors);
    return wrap;
  }

  function buildFinishForm(book: DeskBook): HTMLElement {
    const wrap = el('div');
    wrap.appendChild(backButton(() => setActivity(null)));
    wrap.appendChild(el('h2', undefined, 'Finito, senza testo'));
    const form = el('form', 'form');
    const finito = addField(form, 'Finito il', 'ff-d', book.finito ?? today(), { type: 'date', required: true });
    const getVoto = addVotesField(form, book.voto);
    addSubmit(form, 'Salva');
    const errors = el('div', 'errors');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      void submitLettura(
        book.slug,
        {
          titolo: book.titolo,
          autore: book.autore,
          stato: 'letto',
          pagine: book.pagine ?? undefined,
          anno_opera: book.anno_opera ?? undefined,
          iniziato: book.iniziato ?? undefined,
          finito: finito.value || today(),
          voto: getVoto() ?? undefined,
        },
        errors,
      );
    });
    wrap.append(form, errors);
    return wrap;
  }

  function buildDropForm(book: DeskBook): HTMLElement {
    const wrap = el('div');
    wrap.appendChild(backButton(() => setActivity(null)));
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
      void submitLettura(
        book.slug,
        {
          titolo: book.titolo,
          autore: book.autore,
          stato: 'abbandonato',
          pagine: book.pagine ?? undefined,
          anno_opera: book.anno_opera ?? undefined,
          iniziato: book.iniziato ?? undefined,
          finito: data.value || today(),
          nota: nota.value.trim(),
        },
        errors,
      );
    });
    wrap.append(form, errors);
    return wrap;
  }

  function buildNewForm(): HTMLElement {
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
      void submitLettura(
        undefined,
        {
          titolo: titolo.value.trim(),
          autore: autore.value.trim(),
          stato: 'in-corso',
          anno_opera: anno.value ? Number(anno.value) : undefined,
          pagine: pagine.value ? Number(pagine.value) : undefined,
          iniziato: iniziato.value || today(),
        },
        errors,
      );
    });
    wrap.append(form, errors);
    return wrap;
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
    if (activity === 'edit') panelEl!.appendChild(buildEditForm(book));
    else if (activity === 'finish') panelEl!.appendChild(buildFinishForm(book));
    else if (activity === 'drop') panelEl!.appendChild(buildDropForm(book));
    else if (activity === 'write') panelEl!.appendChild(buildSheet(book, () => setActivity(null)));
    else panelEl!.appendChild(buildActions(book));
  }

  renderShelf();
  renderPanel();
}
