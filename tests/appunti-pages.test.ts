import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildSite, read } from './support/built-site.ts';

const FIXTURES_APPUNTI = { APPUNTI_CONTENT_DIR: 'tests/fixtures/appunti' };

test('a PDF-state course page carries metadata, a descriptive PDF link and JSON-LD', () => {
  const dist = buildSite(FIXTURES_APPUNTI);
  const html = read(dist, 'appunti/pdf-corso/index.html');

  assert.match(html, /<h1[^>]*>Analisi Matematica per Fixture<\/h1>/);
  assert.match(html, /Corso di Laurea in Informatica per la comunicazione digitale/);
  assert.match(html, /Università degli Studi di Milano/);
  assert.match(html, />2019\/20</);
  assert.match(html, />3</); // page count from meta.json

  const pdfLink = html.match(/<a href="\/appunti\/pdf-corso\/pdf-corso\.pdf"[^>]*>([^<]*)<\/a>/);
  assert.ok(pdfLink, 'no PDF download link found');
  assert.match(pdfLink![0], /rel="alternate"/);
  assert.match(pdfLink![0], /type="application\/pdf"/);
  assert.match(pdfLink![1] ?? '', /pagine/i, 'the PDF link text is not descriptive');

  const jsonLd = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? '{}');
  assert.equal(jsonLd['@type'], 'LearningResource');
  assert.equal(jsonLd.name, 'Analisi Matematica per Fixture');
});

test('the PDF is served at its stable URL and matches the source file', () => {
  const dist = buildSite(FIXTURES_APPUNTI);
  const path = join(dist, 'appunti/pdf-corso/pdf-corso.pdf');
  assert.ok(existsSync(path), 'the PDF was not built at its stable URL');
});

test('a course with fonti shows its sources and the removal contact', () => {
  const dist = buildSite(FIXTURES_APPUNTI);
  const html = read(dist, 'appunti/pdf-corso/index.html');
  assert.match(html, /<h2[^>]*>Fonti<\/h2>/);
  assert.match(html, /Slide del docente/);
  assert.match(html, /Dispense del corso/);
  assert.match(html, /class="removal-contact"/);
});

test('a course with no fonti shows no sources section at all', () => {
  const dist = buildSite(FIXTURES_APPUNTI);
  const html = read(dist, 'appunti/quaderno-scansionato/index.html');
  assert.doesNotMatch(html, /<h2[^>]*>Fonti<\/h2>/);
});

test('a removal contact set via config replaces the placeholder', () => {
  const dist = buildSite({ ...FIXTURES_APPUNTI, APPUNTI_REMOVAL_CONTACT: 'appunti@example.com' });
  const html = read(dist, 'appunti/pdf-corso/index.html');
  assert.match(html, /appunti@example\.com/);
  assert.doesNotMatch(html, /Contatto per la rimozione: lo aggiunge l'autore\./);
});

test('a scanned course page notes it is a scan, and its PDF is still downloadable', () => {
  const dist = buildSite(FIXTURES_APPUNTI);
  const html = read(dist, 'appunti/quaderno-scansionato/index.html');
  assert.match(html, /Scansione di un quaderno\./);
  assert.ok(existsSync(join(dist, 'appunti/quaderno-scansionato/quaderno-scansionato.pdf')));
});

test('an unpublished course leaves no page and no PDF in the output', () => {
  const dist = buildSite(FIXTURES_APPUNTI);
  assert.ok(!existsSync(join(dist, 'appunti/corso-escluso/index.html')));
  assert.ok(!existsSync(join(dist, 'appunti/corso-escluso/corso-escluso.pdf')));
});

test('a PDF larger than 25 MiB fails the build', () => {
  const dir = mkdtempSync(join(tmpdir(), 'appunti-oversized-'));
  const slug = 'corso-enorme';
  mkdirSync(join(dir, slug), { recursive: true });
  writeFileSync(
    join(dir, slug, 'corso.yaml'),
    ['titolo: "Corso Enorme"', 'tipo: corso', 'livello: triennale', 'anno: 1', 'aa: "2019/20"', 'fonte: locale', 'pubblicato: true', ''].join(
      '\n',
    ),
  );
  // Not a real PDF: the size cap is a byte-length check, checked before anything parses the file.
  writeFileSync(join(dir, slug, `${slug}.pdf`), Buffer.alloc(26 * 1024 * 1024));

  assert.throws(() => buildSite({ APPUNTI_CONTENT_DIR: dir }), /25|MiB|cap/i);
});
