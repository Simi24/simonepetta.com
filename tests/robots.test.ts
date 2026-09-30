import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSite, read } from './support/built-site.ts';

const robotsTxt = (env: Record<string, string> = {}) => read(buildSite(env), 'robots.txt');

test('disallows all crawling while pre-launch/preview (SITE_INDEXABLE off)', () => {
  const body = robotsTxt();
  assert.match(body, /^User-agent: \*$/m);
  assert.match(body, /^Disallow: \/$/m);
  assert.doesNotMatch(body, /Sitemap:/, 'must not point crawlers at a sitemap while disallowing them');
});

test('once indexable, allows crawling and advertises the sitemap', () => {
  const body = robotsTxt({ SITE_INDEXABLE: 'true' });
  assert.match(body, /^User-agent: \*$/m);
  assert.match(body, /^Allow: \/$/m);
  assert.match(body, /^Sitemap: https:\/\/simonepetta\.com\/sitemap\.xml$/m);
});
