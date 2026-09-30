import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSite, read } from './support/built-site.ts';

const FIXTURES = { LETTURE_CONTENT_DIR: 'tests/fixtures/letture' };
const FIXTURES_SUBSET = { LETTURE_CONTENT_DIR: 'tests/fixtures/letture-subset' };
const FIXTURES_INVALID = { LETTURE_CONTENT_DIR: 'tests/fixtures/letture-invalid' };

const lettureHtml = (env: Record<string, string> = {}) => read(buildSite(env), 'letture/index.html');

/** The book's `<span class="spine ...">` element, as rendered on the shelf. */
const spineFor = (html: string, title: string): string => {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`<span class="([^"]*)"[^>]*style="([^"]*)"[^>]*title="${escaped},`).exec(html);
  if (!match) throw new Error(`no spine found for "${title}"`);
  return match[0];
};

test('the nav links to /letture/', () => {
  const html = lettureHtml();
  assert.match(html, /<nav[^>]*>[\s\S]*<a href="\/letture\/"/);
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

test('the list groups books as Sto leggendo, Letti, Abbandonati, letti ordered by finito descending', () => {
  const html = lettureHtml(FIXTURES);
  assert.match(html, /<h2[^>]*>Sto leggendo<\/h2>/);
  assert.match(html, /<h2[^>]*>Letti<\/h2>/);
  assert.match(html, /<h2[^>]*>Abbandonati<\/h2>/);
  const order = ['Il nome della rosa', 'Il sistema periodico', 'Il deserto dei Tartari'].map((title) =>
    html.indexOf(title),
  );
  assert.ok(order[0]! < order[1]! && order[1]! < order[2]!, 'letti are not ordered by finito descending');
});

test('invalid frontmatter fails the build', () => {
  assert.throws(() => buildSite(FIXTURES_INVALID));
});
