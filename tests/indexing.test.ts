import assert from 'node:assert/strict';
import { test } from 'node:test';
import { builtPages } from './support/built-site.ts';

const NOINDEX = /<meta name="robots" content="noindex"\s*\/?>/;

test('a default build marks every page noindex', () => {
  const pages = builtPages();
  assert.ok(pages.length > 0, 'the build produced no pages');
  for (const { page, html } of pages) {
    assert.match(html, NOINDEX, `${page} is indexable`);
  }
});

test('an indexable build carries no noindex', () => {
  for (const { page, html } of builtPages({ SITE_INDEXABLE: 'true' })) {
    assert.doesNotMatch(html, NOINDEX, `${page} is still noindex`);
  }
});
