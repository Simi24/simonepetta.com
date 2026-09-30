import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { builtPages, filesWithExtension, buildSite } from './support/built-site.ts';

test('the build carries no trace of the writing desk', () => {
  const dist = buildSite();
  const pages = filesWithExtension(dist, '.html');
  assert.ok(!pages.some((page) => page.includes('scrivi')), 'a /scrivi page leaked into the build');
  for (const { page, html } of builtPages()) {
    assert.doesNotMatch(html, /__scrivania/, `${page} references the dev-only save endpoint`);
  }

  // The desk's own JS/CSS must never be bundled into the build's assets either, not just absent
  // from the rendered HTML: a page could reference nothing of it while a shared chunk still did.
  const assets = [...filesWithExtension(dist, '.js'), ...filesWithExtension(dist, '.css')];
  for (const asset of assets) {
    const contents = readFileSync(join(dist, asset), 'utf8');
    assert.doesNotMatch(contents, /scrivania/i, `${asset} references the dev-only writing desk`);
  }
});
