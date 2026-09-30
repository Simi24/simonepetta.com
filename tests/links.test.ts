import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildSite, filesWithExtension, read } from './support/built-site.ts';

const internalHrefs = (html: string): string[] =>
  [...html.matchAll(/\bhref="(\/[^"#?]*)/g)].map((match) => match[1] ?? '');

const resolves = (dist: string, href: string): boolean =>
  existsSync(join(dist, href.endsWith('/') ? `${href}index.html` : href));

test('the header brand links to the home', () => {
  const html = read(buildSite(), 'index.html');
  assert.match(html, /<header[^>]*>[\s\S]*<a[^>]*href="\/"[^>]*>Simone Petta<\/a>/);
});

test('no internal link points to a missing page', () => {
  const dist = buildSite();
  for (const page of filesWithExtension(dist, '.html')) {
    for (const href of internalHrefs(read(dist, page))) {
      assert.ok(resolves(dist, href), `${page} links to missing ${href}`);
    }
  }
});
