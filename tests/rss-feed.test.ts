import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSite, read } from './support/built-site.ts';

const FIXTURES_POST = { LETTURE_CONTENT_DIR: 'tests/fixtures/letture-post' };
const FIXTURES_EMPTY = { LETTURE_CONTENT_DIR: 'tests/fixtures/letture-empty' };
const FIXTURES_ESCAPING = { LETTURE_CONTENT_DIR: 'tests/fixtures/letture-feed-escaping' };

const feedXml = (env: Record<string, string> = {}) => read(buildSite(env), 'letture/rss.xml');

test('is valid, well-formed RSS 2.0 for the readings channel', () => {
  const xml = feedXml();
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<rss version="2\.0"[^>]*>[\s\S]*<\/rss>/);
  assert.match(xml, /<title>Letture<\/title>/);
  assert.match(xml, /<link>https:\/\/simonepetta\.com\/letture\/<\/link>/);
  assert.match(xml, /<language>it<\/language>/);
});

test('contains only books with a text', () => {
  const xml = feedXml(FIXTURES_POST);
  assert.match(xml, /Il più recente/);
  assert.doesNotMatch(xml, /Il senza testo/, 'a book with no body must not appear in the feed');
  assert.doesNotMatch(xml, /Il corpo vuoto/, 'a whitespace-only body must not appear in the feed');
});

test('items are newest first', () => {
  const xml = feedXml(FIXTURES_POST);
  // "In lettura di prova" started 2026-09-28 (no finito yet); "Il più recente" finished 2026-09-25.
  const order = ['In lettura di prova', 'Il più recente', 'Il terzo', 'Abbandonato con testo', 'Il escluso dal recente'].map(
    (title) => xml.indexOf(title),
  );
  assert.ok(order.every((index) => index !== -1), 'not every expected item is in the feed');
  for (let i = 1; i < order.length; i++) assert.ok(order[i - 1]! < order[i]!, 'items are not newest-first');
});

test('links are absolute, with a trailing slash', () => {
  const xml = feedXml(FIXTURES_POST);
  assert.match(xml, /<link>https:\/\/simonepetta\.com\/letture\/il-piu-recente\/<\/link>/);
  assert.match(xml, /<guid isPermaLink="true">https:\/\/simonepetta\.com\/letture\/il-piu-recente\/<\/guid>/);
});

test('XML-significant characters in a title are escaped, not raw', () => {
  const xml = feedXml(FIXTURES_ESCAPING);
  assert.match(xml, /<title>Guerra &amp; &quot;Pace&quot;<\/title>/);
  assert.doesNotMatch(xml, /<title>Guerra & "Pace"<\/title>/);
});

test('with no books at all, the feed is still a valid empty channel, not an empty file', () => {
  const xml = feedXml(FIXTURES_EMPTY);
  assert.match(xml, /<channel>[\s\S]*<\/channel>/);
  assert.doesNotMatch(xml, /<item>/);
});
