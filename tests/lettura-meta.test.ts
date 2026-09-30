import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CollectionEntry } from 'astro:content';
import { postDescription } from '../src/lib/lettura-meta.ts';

function fakeEntry(titolo: string, autore: string): CollectionEntry<'letture'> {
  return { data: { titolo, autore } } as unknown as CollectionEntry<'letture'>;
}

test('carries no em-dash (AGENTS.md: avoid em-dashes in UI copy; it also ships in the feed)', () => {
  const description = postDescription(fakeEntry('Il nome della rosa', 'Umberto Eco'));
  assert.doesNotMatch(description, /—/);
});

test('still reads as title, author, attribution', () => {
  const description = postDescription(fakeEntry('Il nome della rosa', 'Umberto Eco'));
  assert.match(description, /^Il nome della rosa, di Umberto Eco.*Simone Petta\.$/);
});
