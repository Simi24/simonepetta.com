import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildSite, builtPages, read } from './support/built-site.ts';

// A reading with text (a post page) and published courses, so the index has something to find.
const FIXTURES = {
  LETTURE_CONTENT_DIR: 'tests/fixtures/letture-post',
  APPUNTI_CONTENT_DIR: 'tests/fixtures/appunti',
};

test('the build writes a Pagefind index that covers the readings and notes pages', () => {
  const dist = buildSite(FIXTURES);
  assert.ok(existsSync(join(dist, 'pagefind/pagefind.js')), 'pagefind.js is missing from the build');
  const entry = JSON.parse(read(dist, 'pagefind/pagefind-entry.json')) as {
    languages: Record<string, { page_count: number }>;
  };
  const indexed = Object.values(entry.languages).reduce((sum, language) => sum + language.page_count, 0);
  const marked = builtPages(FIXTURES).filter(({ html }) => html.includes('data-pagefind-body')).length;
  assert.ok(marked > 0, 'no page is marked for indexing, so the index would be empty');
  assert.equal(indexed, marked);
});

test('/cerca/ is the only page that references Pagefind assets', () => {
  const pages = builtPages(FIXTURES);
  const search = pages.find(({ page }) => page === 'cerca/index.html');
  assert.ok(search, '/cerca/ is missing');
  assert.match(search.html, /src="\/pagefind\/pagefind-ui\.js"/);
  assert.match(search.html, /href="\/pagefind\/pagefind-ui\.css"/);
  const others = pages.filter(({ page, html }) => page !== 'cerca/index.html' && /pagefind/i.test(html.replace(/data-pagefind-body/g, '')));
  assert.deepEqual(others.map(({ page }) => page), []);
});

test('the nav links to /cerca/ and marks it current on its own page', () => {
  const pages = builtPages(FIXTURES);
  const home = pages.find(({ page }) => page === 'index.html');
  assert.match(home?.html ?? '', /<nav[^>]*>[\s\S]*<a href="\/cerca\/"[^>]*>Cerca<\/a>/);
  const search = pages.find(({ page }) => page === 'cerca/index.html');
  assert.match(search?.html ?? '', /<a href="\/cerca\/" aria-current="page"[^>]*>Cerca<\/a>/);
});
