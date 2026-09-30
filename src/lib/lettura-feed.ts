import type { CollectionEntry } from 'astro:content';
import { hasPost } from './lettura-post.ts';

/** The date a feed entry sorts by: when it was finished, or when it was started for a book still in corso (SPEC.md §6.1). */
function feedDate(entry: CollectionEntry<'letture'>): string {
  return entry.data.finito ?? entry.data.iniziato ?? '';
}

/** Books with a text, newest first (SPEC.md §6.5). */
export function feedEntries(collection: readonly CollectionEntry<'letture'>[]): CollectionEntry<'letture'>[] {
  return collection.filter(hasPost).toSorted((a, b) => feedDate(b).localeCompare(feedDate(a)));
}
