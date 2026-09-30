import type { CollectionEntry } from 'astro:content';
import { hasPost } from './lettura-post.ts';

/**
 * The single date a feed entry is pinned to: when it was finished, or when it was started for
 * a book still in corso (SPEC.md §6.1). `undefined` when the book has neither — an in-corso
 * book with no `iniziato`, or an abbandonato book with no dates at all, both schema-valid
 * (`src/schemas/lettura.ts`) — in which case the feed item carries no `pubDate` (SPEC.md §6.5).
 */
export function feedDate(entry: CollectionEntry<'letture'>): string | undefined {
  return entry.data.finito ?? entry.data.iniziato;
}

/** Books with a text, newest first (SPEC.md §6.5). A book with no date sorts last. */
export function feedEntries(collection: readonly CollectionEntry<'letture'>[]): CollectionEntry<'letture'>[] {
  return collection.filter(hasPost).toSorted((a, b) => (feedDate(b) ?? '').localeCompare(feedDate(a) ?? ''));
}
