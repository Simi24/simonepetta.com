import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSite, filesWithExtension, read } from './support/built-site.ts';

const NOINDEX = /<meta name="robots" content="noindex"\s*\/?>/;

test('a default build marks every page noindex', () => {
  const dist = buildSite();
  const pages = filesWithExtension(dist, '.html');
  assert.ok(pages.length > 0, 'the build produced no pages');
  for (const page of pages) {
    assert.match(read(dist, page), NOINDEX, `${page} is indexable`);
  }
});

test('an indexable build carries no noindex', () => {
  const dist = buildSite({ SITE_INDEXABLE: 'true' });
  for (const page of filesWithExtension(dist, '.html')) {
    assert.doesNotMatch(read(dist, page), NOINDEX, `${page} is still noindex`);
  }
});
