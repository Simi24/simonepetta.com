import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSite, read } from './support/built-site.ts';

const FIXTURES_POST = { LETTURE_CONTENT_DIR: 'tests/fixtures/letture-post' };

const sitemapXml = (env: Record<string, string> = {}) => read(buildSite(env), 'sitemap.xml');

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

test('excludes the utility endpoints that are not pages', () => {
  const xml = sitemapXml();
  assert.doesNotMatch(xml, /404/);
  assert.doesNotMatch(xml, /robots\.txt/);
  assert.doesNotMatch(xml, /sitemap\.xml</, 'the sitemap must not list itself');
});

test('is never empty: at least the three always-present pages', () => {
  const xml = sitemapXml();
  const urlCount = [...xml.matchAll(/<url>/g)].length;
  assert.ok(urlCount >= 3, `expected at least 3 <url> entries, found ${urlCount}`);
});
