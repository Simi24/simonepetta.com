import type { CollectionEntry } from 'astro:content';

/** A book gets a post page only when it has a body: the author's text (SPEC.md §3, §6.2). */
export function hasPost(entry: CollectionEntry<'letture'>): boolean {
  return (entry.body ?? '').trim().length > 0;
}

/** The book's post URL, or `undefined` when it has no post (so the caller renders no link). */
export function postHref(entry: CollectionEntry<'letture'>): string | undefined {
  return hasPost(entry) ? `/letture/${entry.id}/` : undefined;
}
