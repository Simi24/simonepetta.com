import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSite, read } from './support/built-site.ts';

const robotsTxt = (env: Record<string, string> = {}) => read(buildSite(env), 'robots.txt');

test('pre-launch/preview: crawling is allowed (so crawlers can read the pages’ noindex meta), no sitemap advertised', () => {
  const body = robotsTxt();
  assert.match(body, /^User-agent: \*$/m);
  assert.match(body, /^Allow: \/$/m);
  assert.doesNotMatch(body, /Disallow:/, 'crawling must not be blocked: it would hide the noindex meta from crawlers');
  assert.doesNotMatch(body, /Sitemap:/, 'must not advertise a sitemap of pages that are still noindex');
});

test('once indexable: crawling is allowed and the sitemap is advertised', () => {
  const body = robotsTxt({ SITE_INDEXABLE: 'true' });
  assert.match(body, /^User-agent: \*$/m);
  assert.match(body, /^Allow: \/$/m);
  assert.doesNotMatch(body, /Disallow:/);
  assert.match(body, /^Sitemap: https:\/\/simonepetta\.com\/sitemap\.xml$/m);
});
