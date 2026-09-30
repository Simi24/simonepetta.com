import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildSite, read } from './support/built-site.ts';

const FIXTURES_POST = { LETTURE_CONTENT_DIR: 'tests/fixtures/letture-post' };

/** Every page has its own `og:title`/`og:url`, but the readings section shares one image (SPEC.md §12.3). */
function assertReadingsOg(html: string): void {
  assert.match(html, /<meta property="og:image" content="https:\/\/simonepetta\.com\/og\/letture\.png"\s*\/?>/);
  assert.match(html, /<meta property="og:description" content="[^"]+"\s*\/?>/);
  assert.match(html, /<meta property="og:locale" content="it_IT"\s*\/?>/);
}

test('the readings index carries the section Open Graph image and meta tags', () => {
  const html = read(buildSite(), 'letture/index.html');
  assertReadingsOg(html);
  assert.match(html, /<meta property="og:type" content="website"\s*\/?>/);
});

test('a reading post page shares the same section image, as og:type article', () => {
  const html = read(buildSite(FIXTURES_POST), 'letture/il-piu-recente/index.html');
  assertReadingsOg(html);
  assert.match(html, /<meta property="og:type" content="article"\s*\/?>/);
  assert.doesNotMatch(html, /<meta property="og:type" content="website"\s*\/?>/);
});

test('the readings section image is built into dist, alongside the about image', () => {
  const dist = buildSite();
  assert.ok(existsSync(join(dist, 'og/letture.png')), 'og/letture.png was not built');
  assert.ok(existsSync(join(dist, 'og/about.png')), 'og/about.png was not built');
});

test('a course page carries the appunti section Open Graph image, as og:type article', () => {
  const dist = buildSite({ APPUNTI_CONTENT_DIR: 'tests/fixtures/appunti' });
  const html = read(dist, 'appunti/pdf-corso/index.html');
  assert.match(html, /<meta property="og:image" content="https:\/\/simonepetta\.com\/og\/appunti\.png"\s*\/?>/);
  assert.match(html, /<meta property="og:type" content="article"\s*\/?>/);
  assert.ok(existsSync(join(dist, 'og/appunti.png')), 'og/appunti.png was not built');
});
