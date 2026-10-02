import type { CollectionEntry } from 'astro:content';
import { site } from '../config/site.ts';
import { hasPost } from './lettura-post.ts';
import { bookMetaLine } from './lettura-meta-line.ts';

/** A book's line under its title: author, date line, the abandonment note when there is one, and "senza testo" for a finished or abandoned book with no post (SPEC.md §6.2). */
export function metaLine(entry: CollectionEntry<'letture'>): string {
  const noText = entry.data.stato !== 'in-corso' && !hasPost(entry) ? 'senza testo' : '';
  return [bookMetaLine(entry.data), noText].filter(Boolean).join(', ');
}

/** Functional, not author-voice, description shared by a post page's OG tags and its feed item (SPEC.md §1.2 point 3). */
export function postDescription(entry: CollectionEntry<'letture'>): string {
  return `${entry.data.titolo}, di ${entry.data.autore}, dalle letture di ${site.author}.`;
}

/** The readings section's functional description, shared by `/letture/`'s OG tags and the feed's channel (SPEC.md §6.5). */
export const LETTURE_SECTION_DESCRIPTION = `Le letture di ${site.author}: libri letti, in corso e abbandonati.`;
