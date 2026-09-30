import type { CollectionEntry } from 'astro:content';
import { formatDataIt } from './lettura-format-it.ts';
import { ORDERING_DATE } from './lettura-order.ts';
import { STATO_PRESENTATION } from './lettura-presentation.ts';

/** A book's line under its title: author, date line, and the abandonment note when there is one (SPEC.md §6.2). */
export function metaLine(entry: CollectionEntry<'letture'>): string {
  const { autore, stato, nota } = entry.data;
  const date = entry.data[ORDERING_DATE[stato]];
  const parts = [autore, date ? `${STATO_PRESENTATION[stato].dateVerb} ${formatDataIt(date)}` : ''];
  if (stato === 'abbandonato' && nota) parts.push(nota);
  return parts.filter(Boolean).join(', ');
}
