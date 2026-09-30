import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildSite, read } from './support/built-site.ts';

const FIXTURES_POST = { LETTURE_CONTENT_DIR: 'tests/fixtures/letture-post' };
const FIXTURES_EMPTY = { LETTURE_CONTENT_DIR: 'tests/fixtures/letture-empty' };

test('a book with a body gets a post page', () => {
  const dist = buildSite(FIXTURES_POST);
  assert.ok(existsSync(join(dist, 'letture/il-piu-recente/index.html')));
});

test('a book without a body gets no post page', () => {
  const dist = buildSite(FIXTURES_POST);
  assert.ok(!existsSync(join(dist, 'letture/il-senza-testo/index.html')));
});

test('the post shows title, author, year, grade and dates', () => {
  const html = read(buildSite(FIXTURES_POST), 'letture/il-piu-recente/index.html');
  assert.match(html, /<h1[^>]*><cite[^>]*>Il più recente<\/cite><\/h1>/);
  assert.match(html, /<p class="byline"[^>]*>Autrice Di Prova, 1987<\/p>/);
  assert.match(html, /<dt[^>]*>Iniziato<\/dt><dd class="num"[^>]*>1 set 2026<\/dd>/);
  assert.match(html, /<dt[^>]*>Finito<\/dt><dd class="num"[^>]*>25 set 2026<\/dd>/);
  assert.match(html, /<dt[^>]*>Voto<\/dt><dd class="vote-big"[^>]*>4,5<\/dd>/);
});

test('the post renders the book’s text', () => {
  const html = read(buildSite(FIXTURES_POST), 'letture/il-piu-recente/index.html');
  assert.match(html, /<h2[^>]*>■POST-FIXTURE■ titolo di prova<\/h2>/);
  assert.match(html, /■POST-FIXTURE■ paragrafo di prova/);
  assert.match(html, /<blockquote>[\s\S]*■POST-FIXTURE■ citazione di prova[\s\S]*<\/blockquote>/);
});

test('the post links back to the readings index', () => {
  const html = read(buildSite(FIXTURES_POST), 'letture/il-piu-recente/index.html');
  assert.match(html, /<a class="[^"]*back[^"]*" href="\/letture\/"[^>]*>Letture<\/a>/);
});

test('the shelf links a spine to its post when the book has one', () => {
  const html = read(buildSite(FIXTURES_POST), 'letture/index.html');
  assert.match(html, /<a class="spine[^"]*"[^>]*href="\/letture\/il-piu-recente\/"[^>]*title="Il più recente,/);
});

test('the shelf does not link a spine when the book has no post', () => {
  const html = read(buildSite(FIXTURES_POST), 'letture/index.html');
  assert.match(html, /<span class="spine[^"]*"[^>]*title="Il senza testo,/);
  assert.doesNotMatch(html, /<a[^>]*title="Il senza testo,/);
});

test('the list links a book title to its post when the book has one', () => {
  const html = read(buildSite(FIXTURES_POST), 'letture/index.html');
  assert.match(html, /<a class="books__title" href="\/letture\/il-piu-recente\/"[^>]*>Il più recente<\/a>/);
});

test('the list does not link a book title when the book has no post', () => {
  const html = read(buildSite(FIXTURES_POST), 'letture/index.html');
  assert.match(html, /<span class="books__title"[^>]*>Il senza testo<\/span>/);
});

test('the home shows the three most recently finished books, most recent first', () => {
  const html = read(buildSite(FIXTURES_POST), 'index.html');
  const order = ['Il più recente', 'Il senza testo', 'Il terzo'].map((title) => html.indexOf(title));
  assert.ok(order.every((index) => index !== -1), 'not all three recent books appear');
  assert.ok(order[0]! < order[1]! && order[1]! < order[2]!, 'recent books are not ordered by finito descending');
  assert.doesNotMatch(html, /Il escluso dal recente/);
});

test('the home’s recent list never shows an in-corso book', () => {
  const html = read(buildSite(FIXTURES_POST), 'index.html');
  assert.doesNotMatch(html, /In lettura di prova/);
});

test('the home links a recent book to its post when it has one, not when it doesn’t', () => {
  const html = read(buildSite(FIXTURES_POST), 'index.html');
  assert.match(html, /<a class="books__title" href="\/letture\/il-piu-recente\/"[^>]*>Il più recente<\/a>/);
  assert.match(html, /<span class="books__title"[^>]*>Il senza testo<\/span>/);
});

test('with no finished books the home has no recent-readings section', () => {
  const html = read(buildSite(FIXTURES_EMPTY), 'index.html');
  assert.doesNotMatch(html, /Ultime letture/);
});
