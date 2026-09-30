import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { checkBudget, shouldBuildFreshDist } from '../../scripts/quality/check-budget.ts';
import { CLOUDFLARE_BEACON_SCRIPT_SRC, isPagefindAsset } from '../../src/config/budget.ts';
import { buildSite } from '../support/built-site.ts';

/** A minimal fixture "dist" with the given files, for exercising the checker without an Astro build. */
function fixtureDist(files: Record<string, string>): string {
  const dist = mkdtempSync(join(tmpdir(), 'budget-fixture-'));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dist, path)), { recursive: true });
    writeFileSync(join(dist, path), content);
  }
  return dist;
}

test('the current site passes the byte budget (SPEC.md §12.2)', () => {
  assert.deepEqual(checkBudget(buildSite()), []);
});

test('a page with oversized inline JS fails the budget', () => {
  // Random hex, not repeated characters, so gzip cannot shrink it below the cap.
  const oversized = randomBytes(4000).toString('hex');
  const dist = fixtureDist({
    'index.html': `<!doctype html><html><head><script>${oversized}</script></head><body></body></html>`,
  });
  const violations = checkBudget(dist);
  assert.ok(violations.some((v) => v.page === 'index.html' && /JS is \d+ B gzip, over/.test(v.message)));
});

test('a page with oversized HTML fails the budget', () => {
  const oversized = randomBytes(50_000).toString('hex');
  const dist = fixtureDist({ 'index.html': `<!doctype html><html><body><p>${oversized}</p></body></html>` });
  const violations = checkBudget(dist);
  assert.ok(violations.some((v) => v.page === 'index.html' && /HTML is \d+ B gzip, over/.test(v.message)));
});

test('an empty dist fails the budget check', () => {
  const dist = fixtureDist({});
  const violations = checkBudget(dist);
  assert.ok(violations.length > 0, 'an empty dist (or one with no HTML pages) must not pass silently');
});

test('a linked stylesheet is measured with `href` before `rel` (attribute order independence)', () => {
  const oversized = randomBytes(20_000).toString('hex'); // gzips over the 20 KB CSS cap
  const dist = fixtureDist({
    'index.html': '<!doctype html><html><head><link href="/big.css" rel="stylesheet"></head><body></body></html>',
    'big.css': `.oversized{content:"${oversized}"}`,
  });
  const violations = checkBudget(dist);
  assert.ok(violations.some((v) => v.page === 'index.html' && /CSS is \d+ B gzip, over/.test(v.message)));
});

test('a multi-value `rel` still counts as a stylesheet', () => {
  const oversized = randomBytes(20_000).toString('hex');
  const dist = fixtureDist({
    'index.html':
      '<!doctype html><html><head><link href="/big.css" rel="preload stylesheet"></head><body></body></html>',
    'big.css': `.oversized{content:"${oversized}"}`,
  });
  const violations = checkBudget(dist);
  assert.ok(violations.some((v) => v.page === 'index.html' && /CSS is \d+ B gzip, over/.test(v.message)));
});

test('a JSON-LD script block does not count toward the JS budget', () => {
  // Large enough to bust the 1 KB JS cap if it were (wrongly) counted as JS.
  const jsonLd = JSON.stringify({ '@context': 'https://schema.org', '@type': 'LearningResource', id: randomBytes(4000).toString('hex') });
  const dist = fixtureDist({
    'index.html': `<!doctype html><html><head><script type="application/ld+json">${jsonLd}</script></head><body></body></html>`,
  });
  assert.deepEqual(checkBudget(dist), []);
});

test('the Cloudflare beacon script is an accepted cost, not measured against the JS budget', () => {
  const dist = fixtureDist({
    'index.html': `<!doctype html><html><head><script defer src="${CLOUDFLARE_BEACON_SCRIPT_SRC}" data-cf-beacon='{"token":"x"}'></script></head><body></body></html>`,
  });
  assert.deepEqual(checkBudget(dist), []);
});

test('an external script other than the beacon is an undeclared-script violation, not silently free', () => {
  const dist = fixtureDist({
    'index.html': '<!doctype html><html><head><script src="https://example.com/analytics.js"></script></head><body></body></html>',
  });
  const violations = checkBudget(dist);
  assert.ok(
    violations.some((v) => v.page === 'index.html' && /undeclared external script: https:\/\/example\.com\/analytics\.js/.test(v.message)),
  );
});

test('without an explicit reuse flag, a standalone run always rebuilds `dist`', () => {
  assert.equal(shouldBuildFreshDist({ reuseDist: false, distExists: true }), true);
  assert.equal(shouldBuildFreshDist({ reuseDist: false, distExists: false }), true);
});

test('with the reuse flag, an existing `dist` is trusted; a missing one still builds', () => {
  assert.equal(shouldBuildFreshDist({ reuseDist: true, distExists: true }), false);
  assert.equal(shouldBuildFreshDist({ reuseDist: true, distExists: false }), true);
});

const PAGEFIND_UI = '<script src="/pagefind/pagefind-ui.js"></script>';
const bigJs = (): string => `window.x="${randomBytes(4000).toString('hex')}"`;

test('on /cerca/, Pagefind assets are exempt from the JS budget', () => {
  const dist = fixtureDist({
    'cerca/index.html': `<!doctype html><html><head>${PAGEFIND_UI}</head><body></body></html>`,
    'pagefind/pagefind-ui.js': bigJs(),
  });
  assert.deepEqual(checkBudget(dist), []);
});

test('on /cerca/, JS that is not a Pagefind asset still counts against the JS budget', () => {
  const dist = fixtureDist({
    'cerca/index.html': `<!doctype html><html><head>${PAGEFIND_UI}<script>${bigJs()}</script></head><body></body></html>`,
    'pagefind/pagefind-ui.js': bigJs(),
  });
  const violations = checkBudget(dist);
  assert.ok(violations.some((v) => v.page === 'cerca/index.html' && /JS is \d+ B gzip, over/.test(v.message)));
});

test('on any other page, Pagefind assets are not exempt from the JS budget', () => {
  const dist = fixtureDist({
    'letture/index.html': `<!doctype html><html><head>${PAGEFIND_UI}</head><body></body></html>`,
    'pagefind/pagefind-ui.js': bigJs(),
  });
  const violations = checkBudget(dist);
  assert.ok(violations.some((v) => v.page === 'letture/index.html' && /JS is \d+ B gzip, over/.test(v.message)));
});

test('the Pagefind exception accepts only plain Pagefind file paths on /cerca/', () => {
  assert.equal(isPagefindAsset('cerca/index.html', '/pagefind/pagefind-ui.js'), true);
  for (const src of [
    '/pagefind/../big.js',
    '/pagefind/%2e%2e/big.js',
    '/pagefind/sub/dir.js',
    '/pagefind/pagefind-ui.js?x=1',
    '/pagefind/pagefind-ui.js#x',
    '/pagefind/',
    '/pagefindx/pagefind-ui.js',
  ]) {
    assert.equal(isPagefindAsset('cerca/index.html', src), false, src);
  }
});

test('a path-traversal script on /cerca/ is not exempt from the JS budget', () => {
  const dist = fixtureDist({
    'cerca/index.html': '<!doctype html><html><head><script src="/pagefind/../big.js"></script></head><body></body></html>',
    'big.js': bigJs(),
  });
  const violations = checkBudget(dist);
  assert.ok(violations.some((v) => v.page === 'cerca/index.html' && /JS is \d+ B gzip, over/.test(v.message)));
});
