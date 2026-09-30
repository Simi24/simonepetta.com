import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { checkBudget, shouldBuildFreshDist } from '../../scripts/quality/check-budget.ts';
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

test('without an explicit reuse flag, a standalone run always rebuilds `dist`', () => {
  assert.equal(shouldBuildFreshDist({ reuseDist: false, distExists: true }), true);
  assert.equal(shouldBuildFreshDist({ reuseDist: false, distExists: false }), true);
});

test('with the reuse flag, an existing `dist` is trusted; a missing one still builds', () => {
  assert.equal(shouldBuildFreshDist({ reuseDist: true, distExists: true }), false);
  assert.equal(shouldBuildFreshDist({ reuseDist: true, distExists: false }), true);
});
