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

test('an aligned group counts as one display equation, however many rows it has', () => {
  const source = '\\chapter{Uno}\n\\begin{align*}a&=b\\\\c&=d\\end{align*}\n';
  const group =
    '<div class="ltx_equationgroup ltx_eqn_align"><div class="ltx_equation"></div><div class="ltx_equation"></div><div class="ltx_equation"></div></div>';
  assert.deepEqual(detectLeaks(report({ source, chapters: [chapter(group)] })), []);
});

test('an extra equation in the output is a leak too: counts must match exactly', () => {
  const source = '\\chapter{Uno}\n\\begin{equation}a\\end{equation}\n';
  const two = chapter('<div class="ltx_equation"></div><div class="ltx_equation"></div>');
  assert.match(detectLeaks(report({ source, chapters: [two] })).join('\n'), /1 display equation.*2/);
});

test('a lost equation is not hidden by the rows of a group elsewhere', () => {
  const source = '\\chapter{Uno}\n\\begin{equation}a\\end{equation}\n\\begin{align}a&=b\\\\c&=d\\end{align}\n';
  const onlyGroup = chapter('<div class="ltx_equationgroup"><div class="ltx_equation"></div><div class="ltx_equation"></div></div>');
  assert.match(detectLeaks(report({ source, chapters: [onlyGroup] })).join('\n'), /2 display equation.*1/);
});

const boxed = (boxes: number, titles: string[]): ConversionReport['chapters'][number] => ({
  ...chapter(''),
  tcolorboxes: boxes,
  tcolorboxTitles: titles,
});

test('every tcolorbox of the source must come out as a box', () => {
  const source = '\\chapter{Uno}\n\\begin{tcolorbox}[colback=white]\nA\n\\end{tcolorbox}\n\\begin{tcolorbox}\nB\n\\end{tcolorbox}\n';
  assert.match(detectLeaks(report({ source, chapters: [boxed(1, [])] })).join('\n'), /2 tcolorbox.*1/);
  assert.deepEqual(detectLeaks(report({ source, chapters: [boxed(2, [])] })), []);
});

test('every tcolorbox title of the source must come out, as the same words', () => {
  const source =
    '\\chapter{Uno}\n\\begin{tcolorbox}[title=Il mio {\\bf titolo}, sharp corners]\nA\n\\end{tcolorbox}\n\\begin{tcolorbox}[title={Altro, con virgola}]\nB\n\\end{tcolorbox}\n';
  assert.deepEqual(detectLeaks(report({ source, chapters: [boxed(2, ['Il mio titolo', 'Altro, con virgola'])] })), []);
  assert.match(detectLeaks(report({ source, chapters: [boxed(2, [])] })).join('\n'), /2 tcolorbox title.*0/);
  assert.match(detectLeaks(report({ source, chapters: [boxed(2, ['Il mio titolo', 'Altro'])] })).join('\n'), /Altro, con virgola/);
});
