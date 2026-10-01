import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { readAlt } from '../pipeline/alt-text.ts';
import { findTikz, tikzDocument } from '../pipeline/figure-sources.ts';
import { imageSources, planRasters } from '../pipeline/raster-plan.ts';
import { makeTempDir } from './support/temp-root.ts';

const SRC = new URL('./fixtures/figures/src', import.meta.url).pathname;

test('finds the TikZ pictures in the order LaTeXML draws them, whether inline or \\input, keyed by their file', () => {
  const found = findTikz(SRC);
  assert.deepEqual(
    found.map((tikz) => tikz.key),
    ['img/up.tex#1', 'chapters/uno.tex#1', 'chapters/due.tex#1', 'img/up.tex#1'],
  );
  assert.match(found[1]!.code, /inline \$\\vect\{x\}\$/);
});

test('a commented-out picture is not a picture', () => {
  assert.equal(findTikz(SRC).filter((tikz) => tikz.code.includes('draw (0,0);')).length, 0);
});

test('a missing \\input file fails instead of dropping its pictures', () => {
  const dir = makeTempDir('figure-sources-');
  writeFileSync(join(dir, 'main.tex'), '\\begin{document}\\input{nope}\\end{document}');
  assert.throws(() => findTikz(dir), /nope/);
});

test('a standalone document keeps the figure-relevant preamble (packages, libraries, macros) and drops the page setup', () => {
  const [tikz] = findTikz(SRC);
  const doc = tikzDocument(SRC, tikz!);
  assert.match(doc, /^\\documentclass\[dvisvgm,12pt\]\{standalone\}/);
  for (const kept of ['{amsmath}', '{bm}', '\\usetikzlibrary{calc,arrows.meta}', '\\newcommand{\\vect}']) assert.ok(doc.includes(kept), kept);
  for (const dropped of ['geometry', 'hyperref', 'listings', 'lstdefinestyle', 'report']) assert.ok(!doc.includes(dropped), dropped);
  assert.match(doc, /\\begin\{document\}\s*\\begin\{tikzpicture\}[\s\S]*\\end\{tikzpicture\}\s*\\end\{document\}/);
});

test('reads the drafted descriptions from src/alt.json, and none when the course has no file yet', () => {
  const dir = makeTempDir('alt-');
  assert.deepEqual(readAlt(dir), {});
  writeFileSync(join(dir, 'alt.json'), JSON.stringify({ 'images/a.png': 'Un grafo.' }));
  assert.deepEqual(readAlt(dir), { 'images/a.png': 'Un grafo.' });
});

test('a malformed alt.json fails loudly rather than reading as "no descriptions"', () => {
  const dir = makeTempDir('alt-');
  for (const bad of ['{', '[]', '{"a":1}', '{"a":""}']) {
    writeFileSync(join(dir, 'alt.json'), bad);
    assert.throws(() => readAlt(dir), /alt\.json/, bad);
  }
});

test('each image gets a flat WebP name from its path; two images never share one', () => {
  const plan = planRasters(['images/a.png', 'images/architetture/threadWarp.png', 'img/pattern/n16.png', 'images/a.png']);
  assert.deepEqual([...plan], [
    ['images/a.png', 'images-a.webp'],
    ['images/architetture/threadWarp.png', 'images-architetture-threadWarp.webp'],
    ['img/pattern/n16.png', 'img-pattern-n16.webp'],
  ]);
  assert.throws(() => planRasters(['x/a.png', 'x/a.jpg']), /x-a\.webp/);
  assert.throws(() => planRasters(['../secret.png']), /secret/);
});

test('lists the images a page uses, in order', () => {
  assert.deepEqual(imageSources('<img src="images/a.png" alt="x"><p>t</p><img class="c" src="img/b.jpg">'), ['images/a.png', 'img/b.jpg']);
});
