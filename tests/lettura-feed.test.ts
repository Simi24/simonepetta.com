import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CollectionEntry } from 'astro:content';
import { feedDate, feedEntries } from '../src/lib/lettura-feed.ts';

function fakeEntry(overrides: {
  id: string;
  body?: string;
  finito?: string;
  iniziato?: string;
}): CollectionEntry<'letture'> {
  return {
    id: overrides.id,
    body: overrides.body ?? 'un testo di prova',
    data: { finito: overrides.finito, iniziato: overrides.iniziato },
  } as unknown as CollectionEntry<'letture'>;
}

test('feedDate prefers finito over iniziato', () => {
  const entry = fakeEntry({ id: 'a', finito: '2026-05-01', iniziato: '2026-01-01' });
  assert.equal(feedDate(entry), '2026-05-01');
});

test('feedDate falls back to iniziato when there is no finito', () => {
  const entry = fakeEntry({ id: 'a', iniziato: '2026-01-01' });
  assert.equal(feedDate(entry), '2026-01-01');
});

test('feedDate is undefined for a book with neither date, not an empty string', () => {
  const entry = fakeEntry({ id: 'a' });
  assert.equal(feedDate(entry), undefined);
});

test('feedEntries sorts dated books newest first and puts a dateless one last', () => {
  const older = fakeEntry({ id: 'older', finito: '2026-01-01' });
  const newer = fakeEntry({ id: 'newer', finito: '2026-06-01' });
  const dateless = fakeEntry({ id: 'dateless' });
  const ordered = feedEntries([older, dateless, newer]).map((e) => e.id);
  assert.deepEqual(ordered, ['newer', 'older', 'dateless']);
});

test('feedEntries excludes a book with no post', () => {
  const noPost = fakeEntry({ id: 'no-post', body: '   ' });
  const withPost = fakeEntry({ id: 'with-post', finito: '2026-01-01' });
  assert.deepEqual(
    feedEntries([noPost, withPost]).map((e) => e.id),
    ['with-post'],
  );
});
