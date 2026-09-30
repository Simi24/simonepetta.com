import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CLOUDFLARE_BEACON_SCRIPT_SRC } from '../src/config/budget.ts';
import { builtPages } from './support/built-site.ts';
import { escapeRegExp } from './support/regex-escape.ts';

const beaconRegex = new RegExp(
  `<script defer src="${escapeRegExp(CLOUDFLARE_BEACON_SCRIPT_SRC)}" data-cf-beacon="[^"]*token[^"]*"></script>`,
);

test('no token: no beacon, even when indexable', () => {
  // Explicit '', not just an absent env var: this must still hold once the author replaces
  // the committed default with a real token (SPEC.md §12.4) — the absence of this override is
  // not what's under test here, an empty token is.
  for (const { page, html } of builtPages({ CLOUDFLARE_BEACON_TOKEN: '', SITE_INDEXABLE: 'true' })) {
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
