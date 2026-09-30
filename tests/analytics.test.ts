import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CLOUDFLARE_BEACON_SCRIPT_SRC } from '../src/config/budget.ts';
import { builtPages } from './support/built-site.ts';

const beaconRegex = new RegExp(
  `<script defer src="${CLOUDFLARE_BEACON_SCRIPT_SRC.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}" data-cf-beacon="[^"]*token[^"]*"></script>`,
);

test('no token: no beacon, even when indexable', () => {
  for (const { page, html } of builtPages({ SITE_INDEXABLE: 'true' })) {
    assert.doesNotMatch(html, /cloudflareinsights/, `${page} loads the beacon without a token`);
  }
});

test('token set but not indexable (preview/pre-launch): no beacon', () => {
  for (const { page, html } of builtPages({ CLOUDFLARE_BEACON_TOKEN: 'test-token' })) {
    assert.doesNotMatch(html, /cloudflareinsights/, `${page} loads the beacon before launch`);
  }
});

test('token set and indexable: the beacon is present, carrying the token', () => {
  for (const { page, html } of builtPages({ CLOUDFLARE_BEACON_TOKEN: 'test-token', SITE_INDEXABLE: 'true' })) {
    assert.match(html, beaconRegex, `${page} has no beacon`);
  }
});
