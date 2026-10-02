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

test('a launch build without overrides carries the committed Web Analytics token', () => {
  // The value the author copied from the dashboard snippet on 2026-10-02 (public by design).
  const { CLOUDFLARE_BEACON_TOKEN: _override, ...env } = process.env;
  assert.equal(_override, undefined, 'run this test without CLOUDFLARE_BEACON_TOKEN set');
  const home = builtPages({ ...env, SITE_INDEXABLE: 'true' }).find(({ page }) => page === 'index.html');
  assert.ok(home, 'the home page is built');
  assert.match(home.html, /data-cf-beacon="\{&quot;token&quot;:&quot;6a0514e58e274236a0e06d1b6f4ae839&quot;\}"/);
});
