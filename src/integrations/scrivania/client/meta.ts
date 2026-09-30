import { formatDataIt } from '../../../lib/lettura-format-it.ts';
import { ORDERING_DATE } from '../../../lib/lettura-order.ts';
import { STATO_PRESENTATION } from '../../../lib/lettura-presentation.ts';
import type { DeskBook } from './book.ts';

/** `lettura-meta.ts`'s `metaLine`, for a plain client-side book instead of a collection entry. */
export function metaLine(book: DeskBook): string {
  const date = book[ORDERING_DATE[book.stato]];
  const parts = [book.autore, date ? `${STATO_PRESENTATION[book.stato].dateVerb} ${formatDataIt(date)}` : ''];
  if (book.stato === 'abbandonato' && book.nota) parts.push(book.nota);
  return parts.filter(Boolean).join(', ');
}
