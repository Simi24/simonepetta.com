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

test('with no finished books the home has no recent-readings section', () => {
  const html = read(buildSite(FIXTURES_EMPTY), 'index.html');
  assert.doesNotMatch(html, /Ultime letture/);
});

test('a shelf spine link does not carry the listitem role itself: it sits on a wrapping span', () => {
  const html = read(buildSite(FIXTURES_POST), 'letture/index.html');
  assert.doesNotMatch(html, /<a[^>]*role="listitem"/);
  assert.match(html, /<span role="listitem"[^>]*><a class="spine[^"]*"/);
});

test('an abandoned book’s post labels the drop date "Abbandonato", never "Finito"', () => {
  const html = read(buildSite(FIXTURES_POST), 'letture/abbandonato-con-testo/index.html');
  assert.match(html, /<dt[^>]*>Abbandonato<\/dt><dd class="num"[^>]*>1 mag 2026<\/dd>/);
  assert.doesNotMatch(html, /<dt[^>]*>Finito<\/dt>/);
});

test('the post text sits at column 5/span 7, single column under 860px', () => {
  const html = read(buildSite(FIXTURES_POST), 'letture/il-piu-recente/index.html');
  assert.match(html, /\.prose\[[^\]]+\]\{[^}]*grid-column:5\/span 7/);
  assert.match(html, /@media \(width<=860px\)\{[\s\S]*?\.prose\[[^\]]+\]\{grid-column:1\}/);
});

test('the post title uses the prototype’s post size, not the global h1 size', () => {
  const html = read(buildSite(FIXTURES_POST), 'letture/il-piu-recente/index.html');
  assert.match(html, /\.post-head\[[^\]]+\] h1\[[^\]]+\]\{[^}]*font-size:clamp\(2\.6rem,6\.5vw,5\.6rem\)/);
});

test('the post owns its own 12-column grid, independent of .page', () => {
  const html = read(buildSite(FIXTURES_POST), 'letture/il-piu-recente/index.html');
  assert.match(html, /\.post\[[^\]]+\]\{[^}]*grid-template-columns:repeat\(12,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(html, /class="[^"]*page__full[^"]*"/);
});

test('the home’s "Ultime letture" is a block at column 5/span 7, not full width', () => {
  const html = read(buildSite(FIXTURES_POST), 'index.html');
  assert.match(html, /\.recent\[[^\]]+\]\{[^}]*grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(html, /<div class="page__full"><section class="recent"/);
});

test('".num" gives dates tabular figures, as in the prototype', () => {
  const html = read(buildSite(FIXTURES_POST), 'letture/il-piu-recente/index.html');
  assert.match(html, /\.num\[[^\]]+\]\{font-variant-numeric:tabular-nums\}/);
});

test('a book whose body is only whitespace gets no post page', () => {
  const dist = buildSite(FIXTURES_POST);
  assert.ok(!existsSync(join(dist, 'letture/il-corpo-vuoto/index.html')));
});
