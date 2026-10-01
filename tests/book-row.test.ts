import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSite, read } from './support/built-site.ts';
import { tagsWithClass } from './support/html-tags.ts';

const POST = { LETTURE_CONTENT_DIR: 'tests/fixtures/letture-post' };

const metaOf = (html: string, author: string) =>
  tagsWithClass(html, 'book-row__meta').find((tag) => tag.text.startsWith(`${author},`))?.text;

test('a finished book with no text says so in its meta line, with a comma', () => {
  const html = read(buildSite(POST), 'letture/index.html');
  assert.equal(metaOf(html, 'Autore Di Prova'), 'Autore Di Prova, finito il 20 set 2026, senza testo');
});

test('a book with a text does not say "senza testo"', () => {
  const html = read(buildSite(POST), 'letture/index.html');
  assert.equal(metaOf(html, 'Autrice Di Prova')?.includes('senza testo'), false);
  assert.equal(metaOf(html, 'Autore Abbandonato'), 'Autore Abbandonato, abbandonato il 1 mag 2026, lasciato a metà');
});

test('a book being read is never "senza testo"', () => {
  const fixtures = read(buildSite({ LETTURE_CONTENT_DIR: 'tests/fixtures/letture' }), 'letture/index.html');
  assert.equal(metaOf(fixtures, 'Robert M. Pirsig')?.includes('senza testo'), false);
});

test('an abandoned book with no text gets the suffix after its note', () => {
  const html = read(buildSite({ LETTURE_CONTENT_DIR: 'tests/fixtures/letture' }), 'letture/index.html');
  assert.equal(
    metaOf(html, 'Jorge Luis Borges'),
    'Jorge Luis Borges, abbandonato il 15 giu 2026, lasciato a pagina 60, senza testo',
  );
});

test('the readings list and the home share the row: the home uses the compact variant', () => {
  const dist = buildSite(POST);
  const list = tagsWithClass(read(dist, 'letture/index.html'), 'book-row__title');
  const home = tagsWithClass(read(dist, 'index.html'), 'book-row__title');
  assert.ok(list.length > home.length && home.length === 3);
  const compact = (html: string) => (html.match(/<li[^>]*\bclass="[^"]*\bbook-row--compact\b/g) ?? []).length;
  assert.equal(compact(read(dist, 'letture/index.html')), 0);
  assert.equal(compact(read(dist, 'index.html')), 3);
});

test('a title links to its post only when the book has one, in either list', () => {
  const dist = buildSite(POST);
  for (const page of ['letture/index.html', 'index.html']) {
    const titles = tagsWithClass(read(dist, page), 'book-row__title');
    const withPost = titles.find((tag) => tag.text === 'Il più recente');
    const without = titles.find((tag) => tag.text === 'Il senza testo');
    assert.equal(withPost?.name, 'a', page);
    assert.equal(withPost?.attrs['href'], '/letture/il-piu-recente/', page);
    assert.equal(without?.name, 'span', page);
    assert.equal(without?.attrs['href'], undefined, page);
  }
});
