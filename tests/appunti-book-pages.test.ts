import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSite, read } from './support/built-site.ts';

const BOOK = { APPUNTI_CONTENT_DIR: 'tests/fixtures/appunti-book' };

// The master's thesis has acknowledgements, a bibliography and lettered appendices besides its numbered chapters.
test('the course page lists unnumbered pages and appendices by what they are, and chapters by number', () => {
  const html = read(buildSite(BOOK), 'appunti/libro/index.html');
  assert.match(html, /<a href="\/appunti\/libro\/ringraziamenti\/"[^>]*>\s*Ringraziamenti\s*<\/a>/);
  assert.match(html, /<a href="\/appunti\/libro\/1-introduzione\/"[^>]*>\s*<span class="num"[^>]*>1<\/span> Introduzione/);
  assert.match(html, /<a href="\/appunti\/libro\/appendice-a-configurazioni\/"[^>]*>\s*<span class="num"[^>]*>Appendice A<\/span> Configurazioni/);
});

test('an appendix page is titled by its letter, an unnumbered page has no chapter number, neither says "Capitolo"', () => {
  const dist = buildSite(BOOK);
  const appendix = read(dist, 'appunti/libro/appendice-a-configurazioni/index.html');
  assert.match(appendix, /<p class="toc-title"[^>]*>Appendice A<\/p>/);
  assert.doesNotMatch(appendix, /Capitolo \d|Capitolo undefined/);
  assert.match(appendix, /Appendice A, Configurazioni\./);

  const thanks = read(dist, 'appunti/libro/ringraziamenti/index.html');
  assert.doesNotMatch(thanks, /Capitolo \d|undefined|<aside|toc-title/);
});

test('previous and next links name an appendix by its letter', () => {
  const dist = buildSite(BOOK);
  assert.match(read(dist, 'appunti/libro/bibliografia/index.html'), /href="\/appunti\/libro\/appendice-a-configurazioni\/"[^>]*>[\s\S]*?Appendice A Configurazioni/);
  assert.match(read(dist, 'appunti/libro/1-introduzione/index.html'), /href="\/appunti\/libro\/ringraziamenti\/"[^>]*>[\s\S]*?Ringraziamenti/);
});
