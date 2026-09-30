import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toRfc822 } from '../src/lib/rss-date.ts';

test('formats an ISO date as RFC 822 at midnight UTC', () => {
  assert.equal(toRfc822('2026-09-25'), 'Fri, 25 Sep 2026 00:00:00 GMT');
});

test('a different weekday and month format correctly', () => {
  assert.equal(toRfc822('2026-01-01'), 'Thu, 01 Jan 2026 00:00:00 GMT');
});
