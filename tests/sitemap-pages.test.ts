import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CollectionEntry } from 'astro:content';
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
