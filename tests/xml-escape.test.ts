import assert from 'node:assert/strict';
import { test } from 'node:test';
import { escapeXml } from '../src/lib/xml-escape.ts';

test('escapes all five XML-significant characters', () => {
  assert.equal(escapeXml(`&<>"'`), '&amp;&lt;&gt;&quot;&apos;');
});

test('leaves ordinary text untouched', () => {
  assert.equal(escapeXml('Il nome della rosa'), 'Il nome della rosa');
});

test('escapes an ampersand inside a real title', () => {
  assert.equal(escapeXml('Guerra & Pace'), 'Guerra &amp; Pace');
});
