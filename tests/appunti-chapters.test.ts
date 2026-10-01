import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildSite, read } from './support/built-site.ts';

const FIXTURES_APPUNTI = { APPUNTI_CONTENT_DIR: 'tests/fixtures/appunti' };
const MATH_CHAPTER = 'appunti/corso-web/1-variabili-aleatorie-continue/index.html';
const PLAIN_CHAPTER = 'appunti/corso-web/2-secondo/index.html';

test('a converted course has one static page per chapter, with its title and the student-notes notice', () => {
  const dist = buildSite(FIXTURES_APPUNTI);
  const html = read(dist, MATH_CHAPTER);
  assert.match(html, /<html lang="it"/);
  assert.match(html, /<h1[^>]*>Variabili aleatorie continue<\/h1>/);
  assert.match(html, /Appunti di uno studente, non materiale ufficiale del corso\. Possono contenere errori\./);
  assert.match(html, /<a href="\/appunti\/corso-web\/"[^>]*>Probabilità per Fixture<\/a>/);
  assert.ok(existsSync(join(dist, PLAIN_CHAPTER)));
});

test('the chapter table of contents lists its numbered sections as anchors', () => {
  const html = read(buildSite(FIXTURES_APPUNTI), MATH_CHAPTER);
  const toc = /<aside[^>]*aria-label="Indice del capitolo"[\s\S]*?<\/aside>/.exec(html)?.[0] ?? '';
  assert.match(toc, /Capitolo 1/);
  assert.match(toc, /<a href="#S1"[^>]*>1\.1 Densità<\/a>/);
  assert.match(toc, /<a href="#S2"[^>]*>1\.2 Allineamenti<\/a>/);
  assert.match(html, /<section id="S1"/, 'the anchor target is in the chapter');
});

test('the chapter carries native MathML, theorems and proofs, and no script besides the theme one', () => {
  const html = read(buildSite(FIXTURES_APPUNTI), MATH_CHAPTER);
  assert.match(html, /<math[^>]*>[\s\S]*<mfrac>/);
  assert.match(html, /class="ltx_theorem ltx_theorem_theorem"/);
  assert.match(html, /class="ltx_proof"/);
  const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((match) => match[0]);
  assert.deepEqual(scripts, ['<script>', '<script type="application/ld+json">'], 'only the inline theme script and the JSON-LD (SPEC.md §12.2)');
  assert.doesNotMatch(html, /mathjax|katex/i);
});

test('Fira Math is loaded only on the chapter with math', () => {
  const dist = buildSite(FIXTURES_APPUNTI);
  assert.match(read(dist, MATH_CHAPTER), /<link rel="stylesheet" href="\/fonts\/fira-math\.css"/);
  assert.ok(existsSync(join(dist, 'fonts/fira-math.woff2')));
  for (const page of [PLAIN_CHAPTER, 'appunti/corso-web/index.html', 'appunti/index.html', 'index.html']) {
    assert.doesNotMatch(read(dist, page), /fira-math/i, `${page} must not load Fira Math`);
  }
});

test('the chapter list of the course page links every chapter, and the PDF link does not change', () => {
  const html = read(buildSite(FIXTURES_APPUNTI), 'appunti/corso-web/index.html');
  assert.match(html, /<a href="\/appunti\/corso-web\/1-variabili-aleatorie-continue\/"[^>]*>[\s\S]*?Variabili aleatorie continue[\s\S]*?<\/a>/);
  assert.match(html, /<a href="\/appunti\/corso-web\/2-secondo\/"/);
  assert.match(html, /<a href="\/appunti\/corso-web\/corso-web\.pdf"[^>]*rel="alternate"[^>]*type="application\/pdf"/);
});

test('a PDF-state course lists no chapters', () => {
  const html = read(buildSite(FIXTURES_APPUNTI), 'appunti/pdf-corso/index.html');
  assert.doesNotMatch(html, /Capitoli/);
});

test('chapters link to their neighbours and back to the course', () => {
  const dist = buildSite(FIXTURES_APPUNTI);
  const first = read(dist, MATH_CHAPTER);
  const second = read(dist, PLAIN_CHAPTER);
  assert.match(first, /href="\/appunti\/corso-web\/2-secondo\/"[^>]*>[\s\S]*?Secondo/);
  assert.doesNotMatch(first, /Capitolo precedente/);
  assert.match(second, /href="\/appunti\/corso-web\/1-variabili-aleatorie-continue\/"[^>]*>[\s\S]*?Variabili aleatorie continue/);
  assert.match(second, /href="\/appunti\/corso-web\/3-introduzione\/"[^>]*>[\s\S]*?Introduzione/);
  assert.doesNotMatch(read(dist, 'appunti/corso-web/3-introduzione/index.html'), /Capitolo successivo/);
});

test('chapters are indexed for search by their text, not by the chrome around it', () => {
  const html = read(buildSite(FIXTURES_APPUNTI), MATH_CHAPTER);
  assert.match(html, /data-pagefind-body/);
  assert.match(html, /data-pagefind-ignore/);
});

test('chapter pages are in the sitemap', () => {
  const sitemap = read(buildSite(FIXTURES_APPUNTI), 'sitemap.xml');
  assert.match(sitemap, /<loc>[^<]*\/appunti\/corso-web\/1-variabili-aleatorie-continue\/<\/loc>/);
});

test('a PDF-state course has no chapter pages', () => {
  const dist = buildSite(FIXTURES_APPUNTI);
  assert.ok(!existsSync(join(dist, 'appunti/pdf-corso/1-introduzione')));
});
