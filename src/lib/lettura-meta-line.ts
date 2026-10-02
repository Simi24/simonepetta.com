import type { StatoLettura } from '../schemas/lettura.ts';
import { formatDataIt } from './lettura-format-it.ts';
import { ORDERING_DATE } from './lettura-order.ts';
import { STATO_PRESENTATION } from './lettura-presentation.ts';

/** What the line reads from a book; a collection entry's data and the writing desk's plain book both fit. */
interface MetaLineBook {
  autore: string;
  stato: StatoLettura;
  iniziato?: string | null | undefined;
  finito?: string | null | undefined;
  nota?: string | null | undefined;
}

/** A book's line under its title, shared by the list and the writing desk: author, date line, and the abandonment note when there is one (SPEC.md §6.2). */
export function bookMetaLine(book: MetaLineBook): string {
  const date = book[ORDERING_DATE[book.stato]];
  const parts = [book.autore, date ? `${STATO_PRESENTATION[book.stato].dateVerb} ${formatDataIt(date)}` : ''];
  if (book.stato === 'abbandonato' && book.nota) parts.push(book.nota);
  return parts.filter(Boolean).join(', ');
}
