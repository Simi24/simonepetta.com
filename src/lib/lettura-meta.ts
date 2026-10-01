import type { CollectionEntry } from 'astro:content';
import { site } from '../config/site.ts';
import { formatDataIt } from './lettura-format-it.ts';
import { ORDERING_DATE } from './lettura-order.ts';
import { hasPost } from './lettura-post.ts';
import { STATO_PRESENTATION } from './lettura-presentation.ts';

/** A book's line under its title: author, date line, the abandonment note when there is one, and "senza testo" for a finished or abandoned book with no post (SPEC.md §6.2). */
export function metaLine(entry: CollectionEntry<'letture'>): string {
  const { autore, stato, nota } = entry.data;
  const date = entry.data[ORDERING_DATE[stato]];
  const parts = [autore, date ? `${STATO_PRESENTATION[stato].dateVerb} ${formatDataIt(date)}` : ''];
  if (stato === 'abbandonato' && nota) parts.push(nota);
  if (stato !== 'in-corso' && !hasPost(entry)) parts.push('senza testo');
  return parts.filter(Boolean).join(', ');
}

/** Functional, not author-voice, description shared by a post page's OG tags and its feed item (SPEC.md §1.2 point 3). */
export function postDescription(entry: CollectionEntry<'letture'>): string {
  return `${entry.data.titolo}, di ${entry.data.autore}, dalle letture di ${site.author}.`;
}

/** The readings section's functional description, shared by `/letture/`'s OG tags and the feed's channel (SPEC.md §6.5). */
export const LETTURE_SECTION_DESCRIPTION = `Le letture di ${site.author}: libri letti, in corso e abbandonati.`;
