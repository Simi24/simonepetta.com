import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildRssXml } from '../src/lib/rss.ts';

const CHANNEL = {
  title: 'Letture',
  link: 'https://simonepetta.com/letture/',
  selfLink: 'https://simonepetta.com/letture/rss.xml',
  description: 'Le letture di Simone Petta.',
  language: 'it',
  items: [
    {
      title: 'Guerra & Pace',
      link: 'https://simonepetta.com/letture/guerra-e-pace/',
      guid: 'https://simonepetta.com/letture/guerra-e-pace/',
      pubDate: 'Fri, 25 Sep 2026 00:00:00 GMT',
      description: 'Guerra & Pace, di Lev Tolstoj.',
    },
  ],
};

test('produces a well-formed RSS 2.0 document', () => {
  const xml = buildRssXml(CHANNEL);
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<rss version="2\.0"[^>]*>/);
  assert.match(xml, /<channel>[\s\S]*<\/channel>/);
  assert.match(xml, /<title>Letture<\/title>/);
  assert.match(xml, /<link>https:\/\/simonepetta\.com\/letture\/<\/link>/);
  assert.match(xml, /<language>it<\/language>/);
});

test('escapes an ampersand in an item’s title and description', () => {
  const xml = buildRssXml(CHANNEL);
  assert.match(xml, /<title>Guerra &amp; Pace<\/title>/);
  assert.match(xml, /<description>Guerra &amp; Pace, di Lev Tolstoj\.<\/description>/);
  assert.doesNotMatch(xml, /Guerra & Pace/);
});

test('each item carries a permalink guid and pubDate', () => {
  const xml = buildRssXml(CHANNEL);
  assert.match(xml, /<guid isPermaLink="true">https:\/\/simonepetta\.com\/letture\/guerra-e-pace\/<\/guid>/);
  assert.match(xml, /<pubDate>Fri, 25 Sep 2026 00:00:00 GMT<\/pubDate>/);
});

test('an empty item list still produces a valid channel, not an empty document', () => {
  const xml = buildRssXml({ ...CHANNEL, items: [] });
  assert.match(xml, /<channel>[\s\S]*<\/channel>/);
  assert.doesNotMatch(xml, /<item>/);
});
