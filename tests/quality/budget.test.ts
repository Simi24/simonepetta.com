import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkBudget } from '../../scripts/quality/check-budget.ts';
import { buildSite } from '../support/built-site.ts';

/** A minimal fixture "dist" with one page, for exercising the checker without an Astro build. */
function fixtureDist(html: string): string {
  const dist = mkdtempSync(join(tmpdir(), 'budget-fixture-'));
  writeFileSync(join(dist, 'index.html'), html);
  return dist;
}

test('the current site passes the byte budget (SPEC.md §12.2)', () => {
  assert.deepEqual(checkBudget(buildSite()), []);
});

test('a page with oversized inline JS fails the budget', () => {
  // Random hex, not repeated characters, so gzip cannot shrink it below the cap.
  const oversized = randomBytes(4000).toString('hex');
  const dist = fixtureDist(`<!doctype html><html><head><script>${oversized}</script></head><body></body></html>`);
  const violations = checkBudget(dist);
  assert.ok(violations.some((v) => v.page === 'index.html' && /JS is \d+ B gzip, over/.test(v.message)));
});

test('a page with oversized HTML fails the budget', () => {
  const oversized = randomBytes(50_000).toString('hex');
  const dist = fixtureDist(`<!doctype html><html><body><p>${oversized}</p></body></html>`);
  const violations = checkBudget(dist);
  assert.ok(violations.some((v) => v.page === 'index.html' && /HTML is \d+ B gzip, over/.test(v.message)));
});
