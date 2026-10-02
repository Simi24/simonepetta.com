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

const IT_LEDE = 'Software engineer a Milano. Qui tengo traccia di cosa leggo, cosa ho studiato e cosa costruisco.';
const EN_LEDE = 'Software engineer in Milan. This site is where I keep track of what I build and what I have studied.';
const PROJECTS = ['dynantic', 'ralph-gh', 'rideIt', 'SaltinoInterpreter', 'kafka-secure-ha-cluster'];

const section = (html: string, heading: string): string =>
  html.match(new RegExp(`<h2>${heading}</h2>([\\s\\S]*?)</section>`))?.[1] ?? '';

test('the home page (/) carries the IT about texts, with no placeholder left', () => {
  const html = read(buildSite(), 'index.html');
  assert.match(html, /<html lang="it"/);
  assert.ok(html.includes(`<p class="lede">${IT_LEDE}</p>`), 'the IT lede is missing');
  assert.doesNotMatch(html, /class="[^"]*placeholder/);
  assert.match(html, /Sono un software engineer e vivo a Milano\. Lavoro in AdKaora/);
  assert.match(html, /Ho studiato Informatica alla Statale di Milano/);
  const percorso = section(html, 'Percorso');
  for (const when of ['2025–oggi', '2024–2026', '2023–2024', '2020–2023']) {
    assert.ok(percorso.includes(`<span class="when">${when}</span>`), `Percorso lacks ${when}`);
  }
  assert.equal([...percorso.matchAll(/<li>/g)].length, 4);
  assert.match(percorso, /Software engineer, AdKaora \(Milano\)\. Backend e infrastruttura su AWS, Terraform\./);
  const openSource = section(html, 'Open source');
  for (const name of PROJECTS) {
    assert.match(openSource, new RegExp(`<a href="https://github\\.com/Simi24/${name}">${name}</a>`));
  }
  assert.match(openSource, /un ORM per DynamoDB in Python, tipizzato con Pydantic v2/);
});

test('the EN page carries the EN about texts, with no placeholder left', () => {
  const html = read(buildSite(), 'en/index.html');
  assert.ok(html.includes(`<p class="lede">${EN_LEDE}</p>`), 'the EN lede is missing');
  assert.doesNotMatch(html, /class="[^"]*placeholder/);
  assert.match(html, /I&#39;m a software engineer based in Milan\. At AdKaora/);
  assert.match(html, /The rest of this site is in Italian/);
  const path = section(html, 'Path');
  for (const when of ['2025–now', '2024–2026', '2023–2024', '2020–2023']) {
    assert.ok(path.includes(`<span class="when">${when}</span>`), `Path lacks ${when}`);
  }
  const openSource = section(html, 'Open source');
  for (const name of PROJECTS) {
    assert.match(openSource, new RegExp(`<a href="https://github\\.com/Simi24/${name}">${name}</a>`));
  }
  assert.match(openSource, /a typed DynamoDB ORM for Python built on Pydantic v2/);
});

test('Percorso is a timeline (an ol with a when column), not a plain paragraph (SPEC.md §8)', () => {
  const html = read(buildSite(), 'index.html');
  const percorso = section(html, 'Percorso');
  assert.match(percorso, /<ol class="timeline">/);
  const row = percorso.match(/<li>([\s\S]*?)<\/li>/)?.[1] ?? '';
  assert.match(row, /<span class="when">[^<]+<\/span>/);
  assert.match(row, /<span>[^<]+<\/span>/);
});

test('the home page colophon has six IT lines matching the SPEC.md §8 facts', () => {
  const html = read(buildSite(), 'index.html');
  const colophon = html.match(/<h2>Colophon<\/h2>([\s\S]*?)<\/section>/)?.[1] ?? '';
  for (const term of ['Carattere', 'Matematica', 'Appunti', 'Costruzione', 'Hosting', 'Scrittura']) {
    assert.match(colophon, new RegExp(`<dt>${term}</dt>`));
  }
  assert.match(colophon, /Host Grotesk/);
  assert.match(colophon, /Markdown, da una scrivania locale\./);
  assert.doesNotMatch(colophon, /modelli linguistici|assistente/);
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
  assert.doesNotMatch(html, /Percorso|Ultime letture/);
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
  assert.match(colophon, /Markdown, from a local writing desk\./);
  assert.doesNotMatch(colophon, /language models|assistant/);
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
  for (const [page, url, locale] of [
    ['index.html', 'https://simonepetta.com/', 'it_IT'],
    ['en/index.html', 'https://simonepetta.com/en/', 'en_US'],
  ] as const) {
    const html = read(dist, page);
    assert.match(html, /<meta property="og:title" content="Simone Petta"\s*\/?>/);
    assert.match(html, /<meta property="og:image" content="https:\/\/simonepetta\.com\/og\/about\.png"\s*\/?>/);
    assert.match(html, new RegExp(`<meta property="og:url" content="${url.replace(/\//g, '\\/')}"\\s*/?>`));
    assert.match(html, /<meta property="og:type" content="website"\s*\/?>/);
    assert.match(html, new RegExp(`<meta property="og:locale" content="${locale}"\\s*/?>`));
    assert.match(html, /<meta name="twitter:card" content="summary_large_image"\s*\/?>/);
    assert.match(html, /<meta property="og:description" content="[^"]+"\s*\/?>/);
  }
  assert.ok(existsSync(join(dist, 'og/about.png')), 'the OG image was not built into dist');
});
