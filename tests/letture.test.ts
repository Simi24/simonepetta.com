import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSite, read } from './support/built-site.ts';

const FIXTURES = { LETTURE_CONTENT_DIR: 'tests/fixtures/letture' };
const FIXTURES_SUBSET = { LETTURE_CONTENT_DIR: 'tests/fixtures/letture-subset' };
const FIXTURES_INVALID = { LETTURE_CONTENT_DIR: 'tests/fixtures/letture-invalid' };

const lettureHtml = (env: Record<string, string> = {}) => read(buildSite(env), 'letture/index.html');

/** The book's whole `<span class="spine ...">...</span>` element, as rendered on the shelf. */
const spineFor = (html: string, title: string): string => {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`<span class="[^"]*"[^>]*title="${escaped},[^>]*>[\\s\\S]*?</span></span>`).exec(html);
  if (!match) throw new Error(`no spine found for "${title}"`);
  return match[0];
};

test('the nav links to /letture/', () => {
  const html = lettureHtml();
  assert.match(html, /<nav[^>]*>[\s\S]*<a href="\/letture\/"/);
});

test('the lede is a placeholder, not the prototype’s copy', () => {
  const html = lettureHtml();
  assert.match(html, /<p class="lede placeholder[^"]*"[^>]*>/);
  assert.doesNotMatch(html, /Tutto quello che leggo/);
});

test('with no books the shelf shows an empty plank and a one-line caption', () => {
  const html = lettureHtml();
  assert.match(html, /<div class="shelf" role="list"[^>]*><\/div>/);
  assert.match(html, /<p class="caption"[^>]*>Lo scaffale è vuoto\.<\/p>/);
});

test('fixture books never enter the production collection', () => {
  const html = lettureHtml();
  assert.doesNotMatch(html, /Il nome della rosa/);
  assert.doesNotMatch(html, /Sto leggendo/);
});

test('adding a book makes it appear on the shelf and in the list', () => {
  const html = lettureHtml(FIXTURES);
  assert.match(html, /title="Il nome della rosa, Umberto Eco"/);
  assert.match(html, /<span class="books__title"[^>]*>Il nome della rosa<\/span>/);
});

test('spine height follows pagine, clamped to 80..1000, with a 250-page default', () => {
  const html = lettureHtml(FIXTURES);
  assert.match(spineFor(html, 'Il nome della rosa'), /height:20\.5rem/); // 1200 pages, clamped to 1000
  assert.match(spineFor(html, 'Il sistema periodico'), /height:9rem/); // 50 pages, clamped to 80
  assert.match(spineFor(html, 'Il deserto dei Tartari'), /height:11\.125rem/); // no pagine, default 250
});

test('spine width follows pagine too, per the prototype', () => {
  const html = lettureHtml(FIXTURES);
  assert.match(spineFor(html, 'Il nome della rosa'), /width:4\.6rem/); // clamped to 1000: 2.1 + 1000/400
  assert.match(spineFor(html, 'Il sistema periodico'), /width:2\.3rem/); // clamped to 80: 2.1 + 80/400
});

test('a long title is truncated on the spine, as in the prototype', () => {
  const spine = spineFor(lettureHtml(FIXTURES), "Lo Zen e l'arte della manutenzione della motocicletta");
  assert.match(spine, /Lo Zen e l&#39;arte della manutenzio…/);
});

test('the spine carries the author’s surname at full opacity', () => {
  const html = lettureHtml(FIXTURES);
  const spine = spineFor(html, 'Il nome della rosa');
  assert.match(spine, /<span class="spine__author"[^>]*>Eco<\/span>/);
  assert.doesNotMatch(html, /\.spine__author\[[^\]]+\]\{[^}]*opacity/);
});

test('a reading-now book gets the bookmark and an abandoned book leans', () => {
  const html = lettureHtml(FIXTURES);
  assert.match(spineFor(html, "Lo Zen e l'arte della manutenzione della motocicletta"), /spine--in-corso/);
  assert.match(spineFor(html, 'Finzioni'), /spine--abbandonato/);
  assert.doesNotMatch(spineFor(html, 'Il nome della rosa'), /spine--in-corso|spine--abbandonato/);
});

test('a book’s tint does not change when other books are added', () => {
  const solo = spineFor(lettureHtml(FIXTURES_SUBSET), 'Il nome della rosa');
  const withOthers = spineFor(lettureHtml(FIXTURES), 'Il nome della rosa');
  const tint = (spine: string) => /spine--tint-\d/.exec(spine)?.[0];
  assert.ok(tint(solo));
  assert.equal(tint(solo), tint(withOthers));
});

test('grades render as large numerals with an Italian decimal comma', () => {
  const html = lettureHtml(FIXTURES);
  assert.match(html, /<span class="books__vote"[^>]*>4,5<\/span>/);
  assert.match(html, /<span class="books__vote"[^>]*>3,5<\/span>/);
});

test('the list groups books as Sto leggendo, Letti, Abbandonati', () => {
  const html = lettureHtml(FIXTURES);
  assert.match(html, /<h2[^>]*>Sto leggendo<\/h2>/);
  assert.match(html, /<h2[^>]*>Letti<\/h2>/);
  assert.match(html, /<h2[^>]*>Abbandonati<\/h2>/);
});

test('letti are ordered by finito descending', () => {
  const html = lettureHtml(FIXTURES);
  const order = ['Il nome della rosa', 'Il sistema periodico', 'Il deserto dei Tartari'].map((title) =>
    html.indexOf(title),
  );
  assert.ok(order[0]! < order[1]! && order[1]! < order[2]!, 'letti are not ordered by finito descending');
});

test('in corso are ordered by iniziato descending', () => {
  const html = lettureHtml(FIXTURES);
  // "Lo Zen..." started 2026-09-14, "La fisica di Feynman" started 2026-08-01.
  const order = ["Lo Zen e l'arte della manutenzione della motocicletta", 'La fisica di Feynman'].map((title) =>
    html.indexOf(title),
  );
  assert.ok(order[0]! < order[1]!, 'in corso are not ordered by iniziato descending');
});

test('abbandonati are ordered by finito descending', () => {
  const html = lettureHtml(FIXTURES);
  // "Finzioni" finished (was dropped) 2026-06-15, "Se questo è un uomo" 2026-05-01.
  const order = ['Finzioni', 'Se questo è un uomo'].map((title) => html.indexOf(title));
  assert.ok(order[0]! < order[1]!, 'abbandonati are not ordered by finito descending');
});

test('an abandoned book shows its finito date, as well as its nota', () => {
  const html = lettureHtml(FIXTURES);
  assert.match(html, /Jorge Luis Borges, finito il 15 giu 2026, lasciato a pagina 60/);
});

test('the list follows the grid: label in columns 1-4, content from column 5, one column under 860px', () => {
  const html = lettureHtml(FIXTURES);
  assert.match(html, /\.books-group\[[^\]]+\]\{[^}]*grid-template-columns:repeat\(12,minmax\(0,1fr\)\)/);
  assert.match(html, /\.books-group\[[^\]]+\] h2\[[^\]]+\]\{[^}]*grid-column:1\/span 4/);
  assert.match(html, /\.books\[[^\]]+\]\{[^}]*grid-column:5\/-1/);
  assert.match(html, /@media \(width<=860px\)\{[^}]*grid-column:1\/-1/);
});

test('invalid frontmatter fails the build', () => {
  assert.throws(() => buildSite(FIXTURES_INVALID));
});
