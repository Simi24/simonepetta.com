import type { CollectionEntry } from 'astro:content';

/** An excluded course (`pubblicato: false`) gets no page and no PDF in the output (SPEC.md §7.3). */
export function isPublished(entry: CollectionEntry<'appunti'>): boolean {
  return entry.data.pubblicato;
}
