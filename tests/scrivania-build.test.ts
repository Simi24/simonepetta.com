import assert from 'node:assert/strict';
import { test } from 'node:test';
import { builtPages, filesWithExtension, buildSite } from './support/built-site.ts';

test('the build carries no trace of the writing desk', () => {
  const dist = buildSite();
  const pages = filesWithExtension(dist, '.html');
  assert.ok(!pages.some((page) => page.includes('scrivi')), 'a /scrivi page leaked into the build');
  for (const { page, html } of builtPages()) {
    assert.doesNotMatch(html, /__scrivania/, `${page} references the dev-only save endpoint`);
  }
});
