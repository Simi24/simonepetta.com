import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildSite, read } from './support/built-site.ts';

const jsonLdOf = (html: string): unknown => {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(match, 'no JSON-LD script found');
  return JSON.parse(match![1]!);
};

test('the home page (/) carries the IT about sections as visible placeholders', () => {
  const html = read(buildSite(), 'index.html');
  assert.match(html, /<html lang="it"/);
  assert.match(html, /<p class="lede placeholder">[^<]*<\/p>/);
  assert.match(html, /<h2>Percorso<\/h2>/);
  assert.match(html, /<h2>Open source<\/h2>/);
  assert.match(html, /<h2>Colophon<\/h2>/);
  assert.match(html, /dynantic/);
  assert.match(html, /href="https:\/\/github\.com\/Simi24\/dynantic"/);
  // Percorso and the open-source description stay placeholders (SPEC.md §1.2 point 3).
  const percorso = html.match(/<h2>Percorso<\/h2>([\s\S]*?)<\/section>/)?.[1] ?? '';
  assert.match(percorso, /class="placeholder"/);
  const openSource = html.match(/<h2>Open source<\/h2>([\s\S]*?)<\/section>/)?.[1] ?? '';
  assert.match(openSource, /class="placeholder"/);
  // Bio is author-voice too, and has more than one paragraph (SPEC.md §8).
  const bioParagraphs = [...html.matchAll(/<p class="placeholder">Bio[^<]*<\/p>/g)];
  assert.ok(bioParagraphs.length >= 2, 'the bio has fewer than two placeholder paragraphs');
});

test('every EN author-voice block (lede, bio, path, project description) is a placeholder', () => {
  const html = read(buildSite(), 'en/index.html');
  const lede = html.match(/<p class="lede placeholder">([^<]*)<\/p>/)?.[1] ?? '';
  assert.ok(lede.length > 0, 'no placeholder lede on the EN page');
  const bioParagraphs = [...html.matchAll(/<p class="placeholder">Bio[^<]*<\/p>/g)];
  assert.ok(bioParagraphs.length >= 2, 'the EN bio has fewer than two placeholder paragraphs');
  const path = html.match(/<h2>Path<\/h2>([\s\S]*?)<\/section>/)?.[1] ?? '';
  assert.match(path, /class="placeholder"/);
  const openSource = html.match(/<h2>Open source<\/h2>([\s\S]*?)<\/section>/)?.[1] ?? '';
  assert.match(openSource, /class="placeholder"/);
});

test('the home page colophon has six IT lines matching the SPEC.md §8 facts', () => {
  const html = read(buildSite(), 'index.html');
  const colophon = html.match(/<h2>Colophon<\/h2>([\s\S]*?)<\/section>/)?.[1] ?? '';
  for (const term of ['Carattere', 'Matematica', 'Appunti', 'Costruzione', 'Hosting', 'Scrittura']) {
    assert.match(colophon, new RegExp(`<dt>${term}</dt>`));
  }
  assert.match(colophon, /Host Grotesk/);
  assert.match(colophon, /senza modelli linguistici/);
});

test('the home page still shows the latest readings from #26, when there are any', () => {
  const html = read(buildSite({ LETTURE_CONTENT_DIR: 'tests/fixtures/letture' }), 'index.html');
  assert.match(html, /<h2[^>]*>Ultime letture<\/h2>/);
});

test('on the EN page, the brand links to /en/, not the Italian home', () => {
  const html = read(buildSite(), 'en/index.html');
  assert.match(html, /<header[^>]*>[\s\S]*<a[^>]*href="\/en\/"[^>]*>Simone Petta<\/a>/);
});

test('the EN/IT language switch appears in the nav on both pages', () => {
  const dist = buildSite();
  const home = read(dist, 'index.html');
  const en = read(dist, 'en/index.html');
  assert.match(home, /<nav[^>]*>[\s\S]*?<a[^>]*href="\/en\/"[^>]*lang="en"[^>]*>\s*EN\s*<\/a>[\s\S]*?<\/nav>/);
  assert.match(en, /<nav[^>]*>[\s\S]*?<a[^>]*href="\/"[^>]*lang="it"[^>]*>\s*IT\s*<\/a>[\s\S]*?<\/nav>/);
});

test('the EN page exists at /en/, in English, with no Italian content blocks', () => {
  const dist = buildSite();
  assert.ok(existsSync(join(dist, 'en/index.html')), '/en/ was not built');
  const html = read(dist, 'en/index.html');
  assert.match(html, /<html lang="en"/);
  assert.doesNotMatch(html, /Percorso|Ultime letture|Presentazione|la scrive l'autore/);
  assert.match(html, /<h2>Path<\/h2>/);
  assert.match(html, /<h2>Open source<\/h2>/);
  assert.match(html, /<h2>Colophon<\/h2>/);
  assert.doesNotMatch(html, /<h2>Ultime letture<\/h2>/);
});

test('the EN page colophon has six EN lines, not the IT wording', () => {
  const html = read(buildSite(), 'en/index.html');
  const colophon = html.match(/<h2>Colophon<\/h2>([\s\S]*?)<\/section>/)?.[1] ?? '';
  for (const term of ['Typeface', 'Math', 'Notes', 'Build', 'Hosting', 'Writing']) {
    assert.match(colophon, new RegExp(`<dt>${term}</dt>`));
  }
  assert.match(colophon, /without language models/);
  assert.doesNotMatch(colophon, /senza modelli linguistici/);
});

test('both about pages carry a Person JSON-LD with both sameAs URLs', () => {
  for (const page of ['index.html', 'en/index.html']) {
    const html = read(buildSite(), page);
    const ld = jsonLdOf(html) as { '@type': string; name: string; sameAs: string[] };
    assert.equal(ld['@type'], 'Person');
    assert.equal(ld.name, 'Simone Petta');
    assert.ok(ld.sameAs.includes('https://github.com/Simi24'));
    assert.ok(ld.sameAs.includes('https://www.linkedin.com/in/simone-paolo-petta/'));
  }
});

test('the JSON-LD script body on both pages carries no literal "<"', () => {
  for (const page of ['index.html', 'en/index.html']) {
    const html = read(buildSite(), page);
    const body = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? '';
    assert.ok(body.length > 0, `${page}: no JSON-LD body found`);
    assert.ok(!body.includes('<'), `${page}: JSON-LD body contains a literal "<"`);
  }
});

test('both about pages share the same Person @id and url, one identity across languages', () => {
  const dist = buildSite();
  const home = jsonLdOf(read(dist, 'index.html')) as { '@id': string; url: string };
  const en = jsonLdOf(read(dist, 'en/index.html')) as { '@id': string; url: string };
  assert.equal(home['@id'], 'https://simonepetta.com/#person');
  assert.equal(en['@id'], home['@id']);
  assert.equal(en.url, home.url);
});

test('hreflang links the two about pages both ways', () => {
  const dist = buildSite();
  const home = read(dist, 'index.html');
  const en = read(dist, 'en/index.html');
  for (const html of [home, en]) {
    assert.match(html, /<link rel="alternate" hreflang="it" href="https:\/\/simonepetta\.com\/"\s*\/?>/);
    assert.match(html, /<link rel="alternate" hreflang="en" href="https:\/\/simonepetta\.com\/en\/"\s*\/?>/);
  }
});

test("the EN page's meta and OG descriptions don't advertise readings, which it has none of", () => {
  const html = read(buildSite(), 'en/index.html');
  assert.doesNotMatch(html, /content="[^"]*readings[^"]*"/i);
});

test('both about pages carry Open Graph meta tags with a shared, built image', () => {
  const dist = buildSite();
  for (const [page, url] of [
    ['index.html', 'https://simonepetta.com/'],
    ['en/index.html', 'https://simonepetta.com/en/'],
  ] as const) {
    const html = read(dist, page);
    assert.match(html, /<meta property="og:title" content="Simone Petta"\s*\/?>/);
    assert.match(html, /<meta property="og:image" content="https:\/\/simonepetta\.com\/og\/about\.png"\s*\/?>/);
    assert.match(html, new RegExp(`<meta property="og:url" content="${url.replace(/\//g, '\\/')}"\\s*/?>`));
    assert.match(html, /<meta name="twitter:card" content="summary_large_image"\s*\/?>/);
    assert.match(html, /<meta property="og:description" content="[^"]+"\s*\/?>/);
  }
  assert.ok(existsSync(join(dist, 'og/about.png')), 'the OG image was not built into dist');
});
