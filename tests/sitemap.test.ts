import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSite, filesWithExtension, read } from './support/built-site.ts';

const FIXTURES_POST = { LETTURE_CONTENT_DIR: 'tests/fixtures/letture-post' };

const sitemapXml = (env: Record<string, string> = {}) => read(buildSite(env), 'sitemap.xml');

/** A built `*.html` path (e.g. `letture/index.html`, `404.html`) as the page path it serves at. */
function htmlPathToPagePath(file: string): string {
  return '/' + file.replace(/index\.html$/, '').replace(/\.html$/, '');
}

test('lists exactly the built pages, minus 404.html', () => {
  const dist = buildSite(FIXTURES_POST);
  const expectedPaths = new Set(
    filesWithExtension(dist, '.html')
      .filter((file) => file !== '404.html')
      .map(htmlPathToPagePath),
  );
  const locPaths = new Set(
    [...read(dist, 'sitemap.xml').matchAll(/<loc>https:\/\/simonepetta\.com([^<]*)<\/loc>/g)].map((m) => m[1]!),
  );
  assert.deepEqual(locPaths, expectedPaths);
});

test('lists the static pages, each with a git-derived lastmod', () => {
  const xml = sitemapXml();
  for (const path of ['/', '/en/', '/letture/']) {
    const block = new RegExp(`<url>\\s*<loc>https://simonepetta\\.com${path}</loc>\\s*<lastmod>\\d{4}-\\d{2}-\\d{2}</lastmod>\\s*</url>`);
    assert.match(xml, block, `missing or malformed entry for ${path}`);
  }
});

test('lists a book’s post page only when it has one', () => {
  const xml = sitemapXml(FIXTURES_POST);
  assert.match(xml, /<loc>https:\/\/simonepetta\.com\/letture\/il-piu-recente\/<\/loc>/);
  assert.doesNotMatch(xml, /\/letture\/il-senza-testo\//, 'a book with no post page must not be listed');
});
