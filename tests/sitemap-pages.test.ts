import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import type { CollectionEntry } from 'astro:content';
import { APPUNTI_CONTENT_DIR } from '../src/config/appunti-content-dir.ts';
import { LETTURA_CONTENT_DIR } from '../src/config/lettura-content-dir.ts';
import { sitemapPages } from '../src/lib/sitemap-pages.ts';

/** A fake `letture` entry: only the fields `sitemapPages`/`hasPost` actually read. */
function fakeEntry(overrides: {
  id?: string;
  body?: string;
  filePath?: string | undefined;
}): CollectionEntry<'letture'> {
  return {
    id: overrides.id ?? 'il-nome-della-rosa',
    body: overrides.body ?? 'un testo di prova',
    filePath: overrides.filePath,
    data: {},
  } as unknown as CollectionEntry<'letture'>;
}

/** A fake `appunti` entry: only the fields `sitemapPages`/`isPublished` actually read. */
function fakeCorso(overrides: { id?: string; pubblicato?: boolean }): CollectionEntry<'appunti'> {
  return {
    id: overrides.id ?? 'un-corso',
    data: { pubblicato: overrides.pubblicato ?? true },
  } as unknown as CollectionEntry<'appunti'>;
}

test('/ and /letture/ follow both their template and the readings content directory', () => {
  const pages = sitemapPages([]);
  const home = pages.find((p) => p.path === '/');
  const letture = pages.find((p) => p.path === '/letture/');
  assert.ok(home, 'no entry for /');
  assert.ok(letture, 'no entry for /letture/');
  assert.deepEqual(home!.files.sort(), [LETTURA_CONTENT_DIR, 'src/pages/index.astro'].sort());
  assert.deepEqual(letture!.files.sort(), [LETTURA_CONTENT_DIR, 'src/pages/letture/index.astro'].sort());
});

test('/en/ follows only its own template: it renders no readings', () => {
  const pages = sitemapPages([]);
  const en = pages.find((p) => p.path === '/en/');
  assert.ok(en);
  assert.deepEqual(en!.files, ['src/pages/en/index.astro']);
});

test('a post page follows only its own content file', () => {
  const entry = fakeEntry({ id: 'il-nome-della-rosa', filePath: 'src/content/letture/il-nome-della-rosa.md' });
  const pages = sitemapPages([entry]);
  const post = pages.find((p) => p.path === '/letture/il-nome-della-rosa/');
  assert.ok(post);
  assert.deepEqual(post!.files, ['src/content/letture/il-nome-della-rosa.md']);
});

test('a book with no post page is not listed at all', () => {
  const entry = fakeEntry({ id: 'senza-testo', body: '   ' });
  const pages = sitemapPages([entry]);
  assert.ok(!pages.some((p) => p.path.includes('senza-testo')));
});

test('a post entry missing filePath fails loudly, instead of silently falling back to today via an empty pathspec', () => {
  const entry = fakeEntry({ id: 'senza-file-path', filePath: undefined });
  assert.throws(() => sitemapPages([entry]), /senza-file-path/);
});

test('a published course page follows its whole course directory', () => {
  const pages = sitemapPages([], [fakeCorso({ id: 'probabilita-e-statistica' })]);
  const page = pages.find((p) => p.path === '/appunti/probabilita-e-statistica/');
  assert.ok(page);
  assert.deepEqual(page!.files.sort(), [
    'src/pages/appunti/[slug]/index.astro',
    join(APPUNTI_CONTENT_DIR, 'probabilita-e-statistica'),
  ].sort());
});

test('an unpublished course is not listed at all (SPEC.md §7.3)', () => {
  const pages = sitemapPages([], [fakeCorso({ id: 'escluso', pubblicato: false })]);
  assert.ok(!pages.some((p) => p.path.includes('escluso')));
});
