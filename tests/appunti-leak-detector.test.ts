import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectLeaks, type ConversionReport } from '../pipeline/leak-detector.ts';

const chapter = (html: string, figurePending = 0): ConversionReport['chapters'][number] => ({
  numero: 1,
  titolo: 'Uno',
  html: `<div class="ltx_para"><p>${'testo '.repeat(20)}</p></div>${html}`,
  figurePending,
});

const report = (overrides: Partial<ConversionReport> = {}): ConversionReport => ({
  source: '\\chapter{Uno}\nTesto.\n',
  chapters: [chapter('')],
  latexmlErrors: 0,
  extraOutputFiles: [],
  ...overrides,
});

test('a faithful conversion has no leaks', () => {
  assert.deepEqual(detectLeaks(report()), []);
});

test('LaTeXML errors fail the conversion', () => {
  const leaks = detectLeaks(report({ latexmlErrors: 3 }));
  assert.equal(leaks.length, 1);
  assert.match(leaks[0]!, /3 error/);
});

test('an \\includegraphics with no figure in the output is a leak, and so is an extra figure', () => {
  const source = '\\chapter{Uno}\n\\includegraphics[width=1cm]{a.png}\n\\includegraphics{b}\n';
  assert.match(detectLeaks(report({ source, chapters: [chapter('', 1)] })).join('\n'), /2 figure.*1/);
  assert.deepEqual(detectLeaks(report({ source, chapters: [chapter('', 2)] })), []);
  assert.match(detectLeaks(report({ source, chapters: [chapter('', 3)] })).join('\n'), /2 figure.*3/);
});

test('a tikzpicture counts as a figure', () => {
  const source = '\\chapter{Uno}\n\\begin{tikzpicture}\\end{tikzpicture}\n';
  assert.match(detectLeaks(report({ source })).join('\n'), /1 figure.*0/);
});

test('commented-out source is not counted', () => {
  const source = '\\chapter{Uno}\n% \\includegraphics{a}\nTesto 100\\% \\includegraphics{b}\n';
  assert.deepEqual(detectLeaks(report({ source, chapters: [chapter('', 1)] })), []);
});

test('a theorem environment that did not come out as a theorem is a leak', () => {
  const source = '\\newtheorem{teorema}{Teorema}\n\\chapter{Uno}\n\\begin{teorema}A\\end{teorema}\n\\begin{proof}B\\end{proof}\n';
  const leaks = detectLeaks(report({ source })).join('\n');
  assert.match(leaks, /1 theorem/);
  assert.match(leaks, /1 proof/);
  const ok = chapter('<div class="ltx_theorem ltx_theorem_teorema"></div><div class="ltx_proof"></div>');
  assert.deepEqual(detectLeaks(report({ source, chapters: [ok] })), []);
});

test('a display equation that vanished is a leak', () => {
  const source = '\\chapter{Uno}\n\\begin{equation}a\\end{equation}\n\\[ b \\]\n$$ c $$\n';
  assert.match(detectLeaks(report({ source })).join('\n'), /3 display equation/);
  const ok = chapter('<div class="ltx_equation"></div>'.repeat(3));
  assert.deepEqual(detectLeaks(report({ source, chapters: [ok] })), []);
});

test('an unresolved reference or error marker in the output is a leak', () => {
  const bad = chapter('<span class="ltx_ref ltx_missing_label">??</span><span class="ltx_ERROR undefined">\\foo</span>');
  const leaks = detectLeaks(report({ chapters: [bad] })).join('\n');
  assert.match(leaks, /ltx_missing_label/);
  assert.match(leaks, /ltx_ERROR/);
});

test('fewer chapters in the output than \\chapter in the source is a leak', () => {
  const source = '\\chapter{Uno}\n\\chapter{Due}\n';
  assert.match(detectLeaks(report({ source })).join('\n'), /2 chapter.*1/);
});

test('an output file the pipeline does not know is a leak, not silently dropped', () => {
  assert.match(detectLeaks(report({ extraOutputFiles: ['AppA.html'] })).join('\n'), /AppA\.html/);
});

test('an empty chapter is a leak', () => {
  const empty = { numero: 1, titolo: 'Uno', html: '', figurePending: 0 };
  assert.match(detectLeaks(report({ chapters: [empty] })).join('\n'), /empty/);
});
