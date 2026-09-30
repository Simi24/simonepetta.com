import assert from 'node:assert/strict';
import { test } from 'node:test';
import { builtPages } from './support/built-site.ts';

test('every real page has exactly one absolute canonical URL', () => {
  const pages = builtPages().filter(({ page }) => page !== '404.html');
  assert.ok(pages.length > 0, 'the build produced no pages');
  for (const { page, html } of pages) {
    const matches = [...html.matchAll(/<link rel="canonical" href="([^"]+)"/g)];
    assert.equal(matches.length, 1, `${page} has ${matches.length} canonical links, expected exactly 1`);
    const href = matches[0]?.[1];
    assert.match(href ?? '', /^https:\/\/simonepetta\.com\//, `${page}: canonical "${href}" is not absolute`);
  }
});

test('404.html has no canonical: it is not a real page (SPEC.md §3), and its URL does not exist', () => {
  const html = builtPages().find(({ page }) => page === '404.html')?.html ?? '';
  assert.doesNotMatch(html, /<link rel="canonical"/);
});

test('the home and the readings index carry their own canonical, not each other’s', () => {
  const html = new Map(builtPages().map(({ page, html }) => [page, html]));
  assert.match(html.get('index.html') ?? '', /<link rel="canonical" href="https:\/\/simonepetta\.com\/">/);
  assert.match(
    html.get('letture/index.html') ?? '',
    /<link rel="canonical" href="https:\/\/simonepetta\.com\/letture\/">/,
  );
});
