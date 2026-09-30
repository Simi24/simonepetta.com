import assert from 'node:assert/strict';
import { test } from 'node:test';
import { escapeRegExp } from './support/regex-escape.ts';

test('escapes a dot so it matches literally, not as a wildcard', () => {
  const pattern = new RegExp(escapeRegExp('https://static.cloudflareinsights.com/beacon.min.js'));
  assert.match('https://static.cloudflareinsights.com/beacon.min.js', pattern);
  assert.doesNotMatch('https://staticXcloudflareinsightsXcom/beaconXminXjs', pattern, 'a dot must not act as a wildcard');
});

test('escapes every regex-significant character', () => {
  const raw = '.*+?^${}()|[]\\';
  const pattern = new RegExp(`^${escapeRegExp(raw)}$`);
  assert.match(raw, pattern);
});
