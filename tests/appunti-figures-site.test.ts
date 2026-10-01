import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildSite, read } from './support/built-site.ts';

const FIXTURES_APPUNTI = { APPUNTI_CONTENT_DIR: 'tests/fixtures/appunti' };
const FIXTURE_WEBP = 'tests/fixtures/appunti/corso-web/build/figure/figura-prova.webp';

test('a converted course serves its re-encoded images next to its chapters, byte for byte', () => {
  const dist = buildSite(FIXTURES_APPUNTI);
  const served = readFileSync(join(dist, 'appunti/corso-web/figure/figura-prova.webp'));
  assert.deepEqual(served, readFileSync(FIXTURE_WEBP));
});

test('the chapter page points at that image, with dimensions, lazy loading and a description', () => {
  const html = read(buildSite(FIXTURES_APPUNTI), 'appunti/corso-web/3-introduzione/index.html');
  const img = /<img [^>]*class="figura"[^>]*>/.exec(html)?.[0] ?? '';
  assert.match(img, /src="\/appunti\/corso-web\/figure\/figura-prova\.webp"/);
  assert.match(img, /width="684"/);
  assert.match(img, /height="426"/);
  assert.match(img, /loading="lazy"/);
  assert.match(img, /alt="[^"]+"/);
});
