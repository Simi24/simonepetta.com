import { spineLook } from '../../../lib/lettura-spine.ts';
import type { DeskBook } from './book.ts';
import { clear, el } from './dom.ts';

export type Selection = { type: 'new' } | { type: 'book'; slug: string };

interface ShelfHandlers {
  onSelect: (next: Selection | null) => void;
}

/** Draws the shelf as a menu: one spine per book and the dashed one that adds a book (SPEC.md §6.4). */
export function renderShelf(shelfEl: HTMLElement, books: readonly DeskBook[], selection: Selection | null, { onSelect }: ShelfHandlers): void {
  clear(shelfEl);
  for (const book of books) {
    const isSelected = selection?.type === 'book' && selection.slug === book.slug;
    const look = spineLook(book);
    const button = el('button', look.className);
    button.type = 'button';
    button.style.height = `${look.heightRem}rem`;
    button.style.width = `${look.widthRem}rem`;
    button.appendChild(el('span', undefined, look.title));
    button.appendChild(el('span', 'spine__author', look.surname));
    button.setAttribute('aria-label', look.label);
    button.setAttribute('aria-pressed', String(isSelected));
    button.addEventListener('click', () => onSelect(isSelected ? null : { type: 'book', slug: book.slug }));
    shelfEl.appendChild(button);
  }
  const isAdding = selection?.type === 'new';
  const add = el('button', 'spine spine--add', '+ aggiungi');
  add.type = 'button';
  add.setAttribute('aria-pressed', String(isAdding));
  add.addEventListener('click', () => onSelect(isAdding ? null : { type: 'new' }));
  shelfEl.appendChild(add);
}
