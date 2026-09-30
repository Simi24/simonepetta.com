import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildSite, read } from './support/built-site.ts';

const FIXTURES = { APPUNTI_CONTENT_DIR: 'tests/fixtures/appunti' };
const indexHtml = (env: Record<string, string> = FIXTURES) => read(buildSite(env), 'appunti/index.html');

/** The page's CSS: inline `<style>` blocks plus any linked stylesheet (Astro inlines only small ones). */
const indexCss = (env: Record<string, string> = FIXTURES): string => {
  const dist = buildSite(env);
  const html = read(dist, 'appunti/index.html');
  const inline = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]!);
  const linked = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => read(dist, m[1]!));
  return [...inline, ...linked].join('\n');
};

/** The content of the first element matching `<tag ... class="...cls...">...</tag>`, non-nested. */
const section = (html: string, id: string): string => {
  const match = new RegExp(`<section[^>]*id="${id}"[^>]*>([\\s\\S]*?)</section>`).exec(html);
  if (!match) throw new Error(`no section #${id}`);
  return match[1]!;
};

const notebook = (html: string, slug: string): string => {
  const match = new RegExp(`<a [^>]*class="nb [^"]*"[^>]*href="/appunti/${slug}/"[^>]*>[\\s\\S]*?</a>`).exec(
    section(html, 'piles'),
  );
  if (!match) throw new Error(`no notebook for ${slug}`);
  return match[0];
};

const heightPx = (tag: string): number => {
  const match = /height:calc\(1\.35rem \+ (\d+)px\)/.exec(tag);
  if (!match) throw new Error(`no height in ${tag}`);
  return Number(match[1]);
};

test('the nav links to /appunti/ and the page carries a title and the h1', () => {
  const html = indexHtml();
  assert.match(html, /<nav[^>]*>[\s\S]*<a href="\/appunti\/"/);
  assert.match(html, /<h1[^>]*>Appunti<\/h1>/);
  assert.match(html, /<title>Appunti/);
});

test('the lede is an author-voice placeholder', () => {
  assert.match(indexHtml(), /<p class="lede placeholder[^"]*"[^>]*>/);
});

test('theses appear on top and link to their course page', () => {
  const theses = section(indexHtml(), 'tesi');
  assert.match(theses, /<a [^>]*class="thesis"[^>]*href="\/appunti\/tesi-magistrale\/"/);
  assert.match(theses, /<a [^>]*class="thesis"[^>]*href="\/appunti\/tesi-triennale\/"/);
  assert.ok(theses.indexOf('tesi-magistrale') < theses.indexOf('tesi-triennale'), 'magistrale comes first');
  assert.match(theses, /Tesi magistrale, 2025/);
  assert.match(theses, /Tesi triennale, 2022/);
});

test('theses never appear in the piles', () => {
  const html = indexHtml();
  assert.doesNotMatch(section(html, 'piles'), /tesi-(magistrale|triennale)/);
  assert.ok(html.indexOf('id="tesi"') < html.indexOf('id="piles"'), 'theses sit above the piles');
});

test('one pile per year of study, labelled with year and level', () => {
  const piles = section(indexHtml(), 'piles');
  const labels = [...piles.matchAll(/<p class="pile-year"[^>]*>([^<]*)<span[^>]*>([^<]*)<\/span>/g)].map((m) => `${m[1]} ${m[2]}`);
  assert.deepEqual(labels, ['1° anno triennale', '2° anno triennale', '1° anno magistrale']);
});

test('notebook thickness follows the page counts in meta.json', () => {
  const html = indexHtml();
  assert.equal(heightPx(notebook(html, 'corso-web')), 30); // 240 pages
  assert.equal(heightPx(notebook(html, 'pdf-corso')), 0); // 3 pages
  assert.equal(heightPx(notebook(html, 'corso-magistrale')), 10); // 80 pages
  assert.ok(heightPx(notebook(html, 'corso-web')) > heightPx(notebook(html, 'corso-magistrale')));
});

test('a course without meta.json still appears, at the default thickness', () => {
  const tag = notebook(indexHtml(), 'quaderno-scansionato');
  assert.equal(heightPx(tag), 13); // 100 default pages
});

test('a converted course has the tab, a scanned one the dashed outline, a plain PDF neither', () => {
  const html = indexHtml();
  assert.match(notebook(html, 'corso-web'), /class="nb [^"]*\bnb--html\b/);
  assert.match(notebook(html, 'quaderno-scansionato'), /class="nb [^"]*\bnb--scan\b/);
  const plain = notebook(html, 'pdf-corso');
  assert.doesNotMatch(plain, /nb--html|nb--scan/);
});

test('the dashed outline and the tab are styled', () => {
  const css = indexCss();
  assert.match(css, /\.nb--scan[^{]*\{[^}]*outline:1\.5px dashed/);
  assert.match(css, /\.nb--html(\[[^\]]*\])?::?after\{/);
});

test('notebook tints come from the slug hash, not from position', () => {
  const html = indexHtml();
  const tint = (slug: string) => /nb--tint-(\d)/.exec(notebook(html, slug))?.[1];
  assert.ok(tint('corso-web'));
  const withExtra = read(
    buildSite({ APPUNTI_CONTENT_DIR: 'tests/fixtures/appunti-tint-stability' }),
    'appunti/index.html',
  );
  assert.equal(/nb--tint-(\d)/.exec(notebook(withExtra, 'corso-web'))?.[1], tint('corso-web'));
});

test('notebooks carry a descriptive title and no text opacity', () => {
  const html = indexHtml();
  assert.match(notebook(html, 'corso-web'), /title="Probabilità per Fixture, 240 pagine, Web e PDF"/);
  assert.match(notebook(html, 'quaderno-scansionato'), /PDF scansionato/);
  assert.doesNotMatch(indexCss(), /opacity:\s*0?\.\d+/, 'text must not be dimmed with opacity (SPEC.md §5.1)');
});

test('no ARIA role sits on a link', () => {
  assert.doesNotMatch(indexHtml(), /<a [^>]*role=/);
});

test('the full list names every published course, with level, year and pages', () => {
  const list = section(indexHtml(), 'elenco');
  assert.match(list, /<a [^>]*href="\/appunti\/corso-web\/"[^>]*>Probabilità per Fixture<\/a>/);
  assert.match(list, /2° anno triennale/);
  assert.match(list, /240 pag\./);
  assert.match(list, /href="\/appunti\/quaderno-scansionato\/"/);
  assert.doesNotMatch(list, /tesi-/, 'theses are not in the course list');
});

test('the caption explains thickness, tab and dashed outline', () => {
  assert.match(indexHtml(), /Lo spessore segue le pagine di appunti\. La linguetta/);
});

test('the student-notes notice is shown', () => {
  assert.match(indexHtml(), /<p class="notice[^"]*"[^>]*>Appunti di uno studente, non materiale ufficiale dei corsi\./);
});

test('an unpublished course appears nowhere on the index', () => {
  assert.doesNotMatch(indexHtml(), /corso-escluso|Corso Escluso/);
});

test('the sitemap lists /appunti/', () => {
  assert.match(read(buildSite(FIXTURES), 'sitemap.xml'), /<loc>https:\/\/simonepetta\.com\/appunti\/<\/loc>/);
});

const manifest = (titolo: string, tipo: 'corso' | 'tesi'): string =>
  [
    `titolo: "${titolo}"`,
    `tipo: ${tipo}`,
    'livello: triennale',
    ...(tipo === 'corso' ? ['anno: 1', 'aa: "2019/20"'] : ['aa: "2022"']),
    'fonte: locale',
    'pubblicato: true',
    '',
  ].join('\n');

function tempContent(courses: Record<string, 'corso' | 'tesi'>): string {
  const dir = mkdtempSync(join(tmpdir(), 'appunti-index-'));
  for (const [slug, tipo] of Object.entries(courses)) {
    mkdirSync(join(dir, slug));
    writeFileSync(join(dir, slug, 'corso.yaml'), manifest(slug, tipo));
    writeFileSync(join(dir, slug, `${slug}.pdf`), '%PDF-1.4\n');
  }
  return dir;
}

test('with no theses yet, the theses section says so and the layout holds', () => {
  const html = indexHtml({ APPUNTI_CONTENT_DIR: tempContent({ 'solo-corso': 'corso' }) });
  assert.match(section(html, 'tesi'), /Nessuna tesi pubblicata\./);
  assert.doesNotMatch(section(html, 'tesi'), /class="thesis"/);
  assert.match(section(html, 'piles'), /href="\/appunti\/solo-corso\/"/);
});

test('with no courses yet, the piles and the list say so', () => {
  const html = indexHtml({ APPUNTI_CONTENT_DIR: tempContent({ 'solo-tesi': 'tesi' }) });
  assert.match(section(html, 'piles'), /Nessun corso pubblicato\./);
  assert.doesNotMatch(section(html, 'piles'), /class="pile-year"/);
  assert.doesNotMatch(html, /id="elenco"/);
  assert.match(section(html, 'tesi'), /href="\/appunti\/solo-tesi\/"/);
});

test('with nothing at all, both empty lines render', () => {
  const html = indexHtml({ APPUNTI_CONTENT_DIR: tempContent({}) });
  assert.match(section(html, 'tesi'), /Nessuna tesi pubblicata\./);
  assert.match(section(html, 'piles'), /Nessun corso pubblicato\./);
});
