import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildFromLatexml, LeakError, parseLatexmlErrors } from '../pipeline/appunti-build.ts';

const FIXTURES = new URL('./fixtures/latexml/', import.meta.url).pathname;

/** A fake LaTeXML output directory (Ch1, Ch2 from the mini course) plus the course's source. */
function setup(): { htmlDir: string; courseDir: string; source: string } {
  const root = mkdtempSync(join(tmpdir(), 'appunti-build-'));
  const htmlDir = join(root, 'html');
  mkdirSync(htmlDir);
  cpSync(join(FIXTURES, 'mini-Ch1.html'), join(htmlDir, 'Ch1.html'));
  cpSync(join(FIXTURES, 'mini-Ch2.html'), join(htmlDir, 'Ch2.html'));
  writeFileSync(join(htmlDir, 'index.html'), '<html></html>');
  writeFileSync(join(htmlDir, 'LaTeXML.css'), '');
  const courseDir = join(root, 'corso');
  mkdirSync(courseDir);
  return { htmlDir, courseDir, source: readFileSync(join(FIXTURES, 'mini-src/main.tex'), 'utf8') };
}

const readMeta = (courseDir: string) => JSON.parse(readFileSync(join(courseDir, 'build/meta.json'), 'utf8'));

test('reads the error count off LaTeXML\'s own summary line', () => {
  assert.equal(parseLatexmlErrors('Conversion complete: No obvious problems (reqd. 1.3s)'), 0);
  assert.equal(parseLatexmlErrors('Conversion complete: 1 warning (reqd. 1s)'), 0);
  assert.equal(parseLatexmlErrors('Conversion complete: 2 warnings; 3 errors (See x.log) (reqd. 35.36s)'), 3);
  assert.equal(parseLatexmlErrors('Conversion complete: 1 error; 1 missing file (See x.log)'), 1);
});

test('refuses a log with no summary line rather than assuming it was clean', () => {
  assert.throws(() => parseLatexmlErrors('the converter died\n'), /summary/);
});

test('a conversion writes one fragment per chapter and records slugs, sections and math in build/meta.json', () => {
  const { htmlDir, courseDir, source } = setup();
  buildFromLatexml({ htmlDir, courseDir, corso: 'mini', source, latexmlErrors: 0 });

  assert.deepEqual(readdirSync(join(courseDir, 'build')).sort(), [
    '1-variabili-aleatorie-continue.html',
    '2-secondo.html',
    'meta.json',
  ]);
  const meta = readMeta(courseDir);
  assert.equal(meta.capitoli.length, 2);
  assert.deepEqual(meta.capitoli[0], {
    numero: 1,
    slug: '1-variabili-aleatorie-continue',
    titolo: 'Variabili aleatorie continue',
    sezioni: [
      { id: 'S1', numero: '1.1', titolo: 'Densità', sottosezioni: [] },
      { id: 'S2', numero: '1.2', titolo: 'Allineamenti', sottosezioni: [] },
    ],
    math: true,
  });
  assert.equal(meta.capitoli[1].math, false);
  assert.equal('figureInAttesa' in meta, false);
  const fragment = readFileSync(join(courseDir, 'build/1-variabili-aleatorie-continue.html'), 'utf8');
  assert.match(fragment, /class="ltx_theorem /);
});

test('a second run keeps every chapter URL, even when a chapter is renamed in place', () => {
  const { htmlDir, courseDir, source } = setup();
  buildFromLatexml({ htmlDir, courseDir, corso: 'mini', source, latexmlErrors: 0 });
  const first = readMeta(courseDir).capitoli.map((c: { slug: string }) => c.slug);

  const second = mkdtempSync(join(tmpdir(), 'appunti-build-second-'));
  cpSync(join(htmlDir, 'Ch1.html'), join(second, 'Ch1.html'));
  writeFileSync(join(second, 'Ch2.html'), readFileSync(join(htmlDir, 'Ch2.html'), 'utf8').replace(/> Secondo</, '> Secondo, riscritto<'));
  buildFromLatexml({ htmlDir: second, courseDir, corso: 'mini', source, latexmlErrors: 0 });

  const capitoli = readMeta(courseDir).capitoli;
  assert.deepEqual(capitoli.map((c: { slug: string }) => c.slug), first);
  assert.equal(capitoli[1].titolo, 'Secondo, riscritto');
  assert.deepEqual(readdirSync(join(courseDir, 'build')).sort(), [`${first[0]}.html`, `${first[1]}.html`, 'meta.json']);
});

test('a chapter inserted before an existing one does not take its URL', () => {
  const { htmlDir, courseDir, source } = setup();
  buildFromLatexml({ htmlDir, courseDir, corso: 'mini', source, latexmlErrors: 0 });
  const first = readMeta(courseDir).capitoli.map((c: { slug: string }) => c.slug);

  const second = mkdtempSync(join(tmpdir(), 'appunti-build-inserted-'));
  const ch2 = readFileSync(join(htmlDir, 'Ch2.html'), 'utf8');
  cpSync(join(htmlDir, 'Ch1.html'), join(second, 'Ch1.html'));
  writeFileSync(join(second, 'Ch2.html'), ch2.replace(/> Secondo</, '> Nuovo capitolo<'));
  writeFileSync(join(second, 'Ch3.html'), ch2.replace(/Chapter 2/g, 'Chapter 3'));
  buildFromLatexml({ htmlDir: second, courseDir, corso: 'mini', source: `${source}\n\\chapter{Terzo}\n`, latexmlErrors: 0 });

  const slugs = readMeta(courseDir).capitoli.map((c: { slug: string }) => c.slug);
  assert.equal(slugs[0], first[0]);
  assert.equal(slugs[1], '2-nuovo-capitolo');
  assert.equal(slugs[2], first[1], 'the old chapter 2 kept its URL after moving to position 3');
});

test('a leak fails the conversion and leaves the last good build/ untouched', () => {
  const { htmlDir, courseDir, source } = setup();
  buildFromLatexml({ htmlDir, courseDir, corso: 'mini', source, latexmlErrors: 0 });
  const before = readFileSync(join(courseDir, 'build/meta.json'), 'utf8');

  assert.throws(
    () => buildFromLatexml({ htmlDir, courseDir, corso: 'mini', source: `${source}\n\\includegraphics{x.png}\n`, latexmlErrors: 0 }),
    (error) => error instanceof LeakError && error.leaks.some((leak) => /image/.test(leak)),
  );
  assert.equal(readFileSync(join(courseDir, 'build/meta.json'), 'utf8'), before);
  assert.ok(!existsSync(join(courseDir, 'build.next')));
});

test('a first conversion that leaks leaves no build/ behind, so the course stays a PDF course', () => {
  const { htmlDir, courseDir, source } = setup();
  assert.throws(() => buildFromLatexml({ htmlDir, courseDir, corso: 'mini', source, latexmlErrors: 2 }), LeakError);
  assert.ok(!existsSync(join(courseDir, 'build')));
});

test('an output file the pipeline does not know fails the conversion', () => {
  const { htmlDir, courseDir, source } = setup();
  writeFileSync(join(htmlDir, 'AppA.html'), '<html></html>');
  assert.throws(
    () => buildFromLatexml({ htmlDir, courseDir, corso: 'mini', source, latexmlErrors: 0 }),
    (error) => error instanceof LeakError && error.leaks.some((leak) => /AppA\.html/.test(leak)),
  );
});

const SIMT = 'images/simtvssimd.png';
const WEBP_BYTES = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3]);

/** A one-chapter course whose chapter has one raster figure (LaTeXML's real output for GPUcomputing's chapter 1). */
function setupWithFigure(alt: Record<string, string>) {
  const { htmlDir, courseDir } = setup();
  rmSync(join(htmlDir, 'Ch2.html'));
  cpSync(join(FIXTURES, 'gpu-Ch1.html'), join(htmlDir, 'Ch1.html'));
  return {
    htmlDir,
    courseDir,
    corso: 'gpu',
    source: `\\chapter{Introduzione}\n\\includegraphics{${SIMT}}\n`,
    latexmlErrors: 0,
    figures: {
      rasters: new Map([[SIMT, { name: 'images-simtvssimd.webp', width: 830, height: 316 }]]),
      tikz: [],
      alt,
    },
    figureBytes: new Map([['images-simtvssimd.webp', WEBP_BYTES]]),
  };
}

test('a figure is installed with its chapter: the WebP in build/figure/, the page pointing at it', () => {
  const input = setupWithFigure({ [SIMT]: 'Confronto fra SIMD e SIMT.' });
  buildFromLatexml(input);
  assert.deepEqual(readFileSync(join(input.courseDir, 'build/figure/images-simtvssimd.webp')), Buffer.from(WEBP_BYTES));
  const page = readFileSync(join(input.courseDir, 'build/1-introduzione.html'), 'utf8');
  assert.match(page, /src="\/appunti\/gpu\/figure\/images-simtvssimd\.webp"[^>]*alt="Confronto fra SIMD e SIMT\."/);
});

test('a figure with no description fails the conversion and leaves the course as it was', () => {
  const input = setupWithFigure({});
  assert.throws(
    () => buildFromLatexml(input),
    (error) =>
      error instanceof LeakError &&
      error.leaks.some((leak) => /images-simtvssimd\.webp has no description/.test(leak)) &&
      error.leaks.some((leak) => leak.includes('alt.json') && leak.includes(SIMT)),
  );
  assert.ok(!existsSync(join(input.courseDir, 'build')));
});
