import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSite, filesWithExtension, read } from './support/built-site.ts';
import { openingTagsWithClass, tagsWithClass } from './support/html-tags.ts';

const FIXTURES = { LETTURE_CONTENT_DIR: 'tests/fixtures/letture' };
const FIXTURES_EMPTY = { LETTURE_CONTENT_DIR: 'tests/fixtures/letture-empty' };
const FIXTURES_SUBSET = { LETTURE_CONTENT_DIR: 'tests/fixtures/letture-subset' };
const FIXTURES_INVALID = { LETTURE_CONTENT_DIR: 'tests/fixtures/letture-invalid' };

// Present only in tests/fixtures/letture/zz-fixture-sentinel.md, never a real book: a marker the
// isolation test can look for without depending on what the author has (or hasn't) published to
// src/content/letture/ yet.
const FIXTURE_MARKER = '■FIXTURE-ONLY■';

const lettureHtml = (env: Record<string, string> = {}) => read(buildSite(env), 'letture/index.html');

/** The book's whole spine element (opening tag to the end of its author span), as rendered on the shelf. */
const spineFor = (html: string, title: string): string => {
  const tag = openingTagsWithClass(html, 'spine').find((candidate) => candidate.attrs['title']?.startsWith(`${title},`));
  if (!tag) throw new Error(`no spine found for "${title}"`);
  return /^[\s\S]*?<\/span><\/span>/.exec(html.slice(tag.index))![0];
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

test('the lede sits at grid-column 5/span 6, per the prototype', () => {
  // The shared stylesheet is inlined only while it stays under Astro's 4 KB limit, so read the linked sheets too.
  const dist = buildSite();
  const css = filesWithExtension(dist, '.css').map((file) => read(dist, file));
  assert.match([lettureHtml(), ...css].join('\n'), /\.lede\{[^}]*grid-column:5\/span 6/);
});

test('the shelf does not shrink its spines: it scrolls instead', () => {
  // The shelf's stylesheet is shared with the writing desk, so it is a linked file, not inlined.
  const dist = buildSite(FIXTURES);
  const css = filesWithExtension(dist, '.css').map((file) => read(dist, file));
  assert.match([lettureHtml(FIXTURES), ...css].join('\n'), /\.shelf(\[[^\]]+\])?\{[^}]*min-width:min-content/);
});

test('with no books the shelf shows an empty plank and a one-line caption', () => {
  const html = lettureHtml(FIXTURES_EMPTY);
  const [shelf] = openingTagsWithClass(html, 'shelf');
  assert.equal(shelf?.attrs['role'], 'list');
  assert.ok(html.slice(shelf!.index + shelf!.raw.length).startsWith('</div>'), 'the shelf is not empty');
  assert.ok(tagsWithClass(html, 'caption').some((tag) => tag.text === 'Lo scaffale è vuoto.'));
});

test('fixture books never enter the production collection', () => {
  // Builds the real src/content/letture/, not a fixture override: whatever the author has
  // published there (possibly nothing yet) must never contain a fixture's marker.
  const html = lettureHtml();
  assert.doesNotMatch(html, new RegExp(FIXTURE_MARKER));
});

test('adding a book makes it appear on the shelf and in the list', () => {
  const html = lettureHtml(FIXTURES);
  assert.match(html, /title="Il nome della rosa, Umberto Eco"/);
  assert.ok(tagsWithClass(html, 'book-row__title').some((tag) => tag.text === 'Il nome della rosa'));
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

test('a letto spine has no trailing space in its class attribute', () => {
  const html = lettureHtml(FIXTURES);
  const classes = openingTagsWithClass(html, 'spine').map((tag) => tag.attrs['class']!);
  assert.ok(classes.some((value) => /^spine spine--tint-\d$/.test(value)));
  assert.ok(classes.every((value) => value === value.trim()));
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
  const votes = tagsWithClass(html, 'book-row__vote').map((tag) => tag.text);
  assert.ok(votes.includes('4,5') && votes.includes('3,5'));
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

test('an abandoned book shows a dropped-on date, not a "finito il", as well as its nota', () => {
  const html = lettureHtml(FIXTURES);
  assert.match(html, /Jorge Luis Borges, abbandonato il 15 giu 2026, lasciato a pagina 60/);
  assert.match(html, /Primo Levi, abbandonato il 1 mag 2026/); // no nota on this one
});

test('"finito il" appears only for letti, never for abbandonati', () => {
  const html = lettureHtml(FIXTURES);
  const abbandonatiSection = /<h2[^>]*>Abbandonati<\/h2>[\s\S]*?<\/section>/.exec(html)?.[0];
  assert.ok(abbandonatiSection);
  assert.doesNotMatch(abbandonatiSection, /finito il/);
  const lettiSection = /<h2[^>]*>Letti<\/h2>[\s\S]*?<\/section>/.exec(html)?.[0];
  assert.ok(lettiSection);
  assert.match(lettiSection, /finito il/);
});

test('the list follows the grid: label in columns 1-4, content from column 5, one column under 860px', () => {
  const html = lettureHtml(FIXTURES);
  assert.match(html, /\.books-group\[[^\]]+\]\{[^}]*grid-template-columns:repeat\(12,minmax\(0,1fr\)\)/);
  assert.match(html, /\.books-group\[[^\]]+\] h2\[[^\]]+\]\{[^}]*grid-column:1\/span 4/);
  assert.match(html, /\.books-group\[[^\]]+\] \.book-list\{[^}]*grid-column:5\/-1/);
  assert.match(html, /@media \(width<=860px\)\{[^}]*grid-column:1\/-1/);
});

test('invalid frontmatter fails the build with the schema error, not just any failure', () => {
  // The fixture is missing "autore" (SPEC.md §6.1): the build must fail with exactly that
  // schema error, naming the field, not merely fail for some other reason.
  assert.throws(
    () => buildSite(FIXTURES_INVALID),
    (error: unknown) => {
      const output = String((error as { stderr?: Buffer }).stderr ?? '');
      return /InvalidContentEntryDataError/.test(output) && /il campo "autore"/.test(output);
    },
  );
});
