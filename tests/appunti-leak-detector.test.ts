import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectLeaks, type ConversionReport } from '../pipeline/leak-detector.ts';

const chapter = (html: string): ConversionReport['chapters'][number] => ({
  numero: 1,
  titolo: 'Uno',
  html: `<div class="ltx_para"><p>${'testo '.repeat(20)}</p></div>${html}`,
});

const IMG = (attributes = ''): string =>
  `<img class="figura" src="/appunti/c/figure/a.webp" width="800" height="600" loading="lazy" alt="Uno schema" ${attributes}>`;
const SVG = (label = 'Un grafo'): string => `<svg class="figura-tikz" role="img" aria-label="${label}"><path stroke="currentColor"/></svg>`;

const report = (overrides: Partial<ConversionReport> = {}): ConversionReport => ({
  source: '\\chapter{Uno}\nTesto.\n',
  chapters: [chapter('')],
  latexmlErrors: 0,
  extraOutputFiles: [],
  figureFiles: ['a.webp'],
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

test('an \\includegraphics with no image in the output is a leak, and so is an extra image', () => {
  const source = '\\chapter{Uno}\n\\includegraphics[width=1cm]{a.png}\n\\includegraphics{b}\n';
  assert.match(detectLeaks(report({ source, chapters: [chapter(IMG())] })).join('\n'), /2 image.*1/);
  assert.deepEqual(detectLeaks(report({ source, chapters: [chapter(IMG() + IMG())] })), []);
  assert.match(detectLeaks(report({ source, chapters: [chapter(IMG().repeat(3))] })).join('\n'), /2 image.*3/);
});

test('a tikzpicture with no SVG in the output is a leak, and so is an extra SVG', () => {
  const source = '\\chapter{Uno}\n\\begin{tikzpicture}\\end{tikzpicture}\n';
  assert.match(detectLeaks(report({ source })).join('\n'), /1 TikZ.*0/);
  assert.deepEqual(detectLeaks(report({ source, chapters: [chapter(SVG())] })), []);
  assert.match(detectLeaks(report({ source, chapters: [chapter(SVG() + SVG())] })).join('\n'), /1 TikZ.*2/);
});

test('an image without a description is a leak, so is a TikZ picture without one', () => {
  const source = '\\chapter{Uno}\n\\includegraphics{a}\n\\begin{tikzpicture}\\end{tikzpicture}\n';
  const bare = chapter(IMG().replace('alt="Uno schema"', 'alt=""') + SVG(''));
  const leaks = detectLeaks(report({ source, chapters: [bare] })).join('\n');
  assert.match(leaks, /image a\.webp has no description/);
  assert.match(leaks, /TikZ picture has no description/);
  assert.deepEqual(detectLeaks(report({ source, chapters: [chapter(IMG() + SVG())] })), []);
});

test('an image without alt at all, or with a blank one, has no description', () => {
  const source = '\\chapter{Uno}\n\\includegraphics{a}\n';
  for (const html of [IMG().replace(' alt="Uno schema"', ''), IMG().replace('alt="Uno schema"', 'alt="  "')]) {
    assert.match(detectLeaks(report({ source, chapters: [chapter(html)] })).join('\n'), /no description/);
  }
});

test('an image must be a produced WebP file, lazy, with dimensions of at most 1600 px', () => {
  const source = '\\chapter{Uno}\n\\includegraphics{a}\n';
  const leaksFor = (html: string, figureFiles = ['a.webp']): string =>
    detectLeaks(report({ source, chapters: [chapter(html)], figureFiles })).join('\n');
  assert.match(leaksFor(IMG(), []), /a\.webp is not among the produced files/);
  assert.match(leaksFor(IMG().replace('width="800"', 'width="1601"')), /wider than 1600/);
  assert.match(leaksFor(IMG().replace(' width="800"', '')), /width/);
  assert.match(leaksFor(IMG().replace(' height="600"', '')), /height/);
  assert.match(leaksFor(IMG().replace(' loading="lazy"', '')), /lazy/);
  assert.match(leaksFor(IMG().replace('a.webp', 'a.png')), /not a WebP/);
  assert.equal(leaksFor(IMG().replace('width="800"', 'width="1600"')), '');
});

test('a TikZ picture that kept hard black is a leak: it would vanish in the dark theme', () => {
  const source = '\\chapter{Uno}\n\\begin{tikzpicture}\\end{tikzpicture}\n';
  const black = '<svg class="figura-tikz" role="img" aria-label="x"><path stroke="#000"/></svg>';
  assert.match(detectLeaks(report({ source, chapters: [chapter(black)] })).join('\n'), /currentColor/);
});

test('commented-out source is not counted', () => {
  const source = '\\chapter{Uno}\n% \\includegraphics{a}\nTesto 100\\% \\includegraphics{b}\n';
  assert.deepEqual(detectLeaks(report({ source, chapters: [chapter(IMG())] })), []);
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
  const empty = { numero: 1, titolo: 'Uno', html: '' };
  assert.match(detectLeaks(report({ chapters: [empty] })).join('\n'), /chapter 1 "Uno" is empty/);
});

test('an empty page that is not a numbered chapter is named for what it is', () => {
  const leaks = detectLeaks(
    report({ chapters: [{ titolo: 'Ringraziamenti', html: '' }, { etichetta: 'Appendice A', titolo: 'Config', html: '' }, { titolo: 'Bibliografia', bibliografia: true, html: '' }] }),
  ).join('\n');
  assert.match(leaks, /unnumbered page "Ringraziamenti" is empty/);
  assert.match(leaks, /appendix "Appendice A: Config" is empty/);
  assert.match(leaks, /bibliography "Bibliografia" is empty/);
  assert.doesNotMatch(leaks, /undefined/);
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

test('a report whose chapters do not record tcolorboxes (a committed build) is not held to their count', () => {
  const source = '\\chapter{Uno}\n\\begin{tcolorbox}[title=Titolo]\nA\n\\end{tcolorbox}\n';
  assert.deepEqual(detectLeaks(report({ source })), []);
});

const LISTING = (...lines: string[]): string =>
  `<pre class="listing" tabindex="0"><code>${lines.map((line) => `<span class="ltx_listingline">${line}</span>`).join('\n')}</code></pre>`;

const SOURCE_WITH_LISTINGS =
  '\\chapter{Uno}\n\\begin{lstlisting}[label={lst:a}]\nprimo\n\n  terzo\n  \\end{lstlisting}\n\\begin{lstlisting}\nsolo\n\\end{lstlisting}\n';

test('a code listing and each of its lines must come out: a faithful conversion has no leaks', () => {
  const html = LISTING('primo', '', '  terzo') + LISTING('solo');
  assert.deepEqual(detectLeaks(report({ source: SOURCE_WITH_LISTINGS, chapters: [chapter(html)] })), []);
});

test('a lost code listing is a leak, and so is an extra one', () => {
  assert.match(detectLeaks(report({ source: SOURCE_WITH_LISTINGS, chapters: [chapter(LISTING('primo', '', '  terzo'))] })).join('\n'), /2 code listing.*1/);
  assert.match(detectLeaks(report({ source: SOURCE_WITH_LISTINGS, chapters: [chapter(LISTING('primo', '', '  terzo') + LISTING('solo') + LISTING('x'))] })).join('\n'), /2 code listing.*3/);
});

test('a listing that lost lines is a leak, even when the total number of lines still matches', () => {
  const leaks = detectLeaks(report({ source: SOURCE_WITH_LISTINGS, chapters: [chapter(LISTING('primo', 'terzo') + LISTING('solo', 'extra'))] })).join('\n');
  assert.match(leaks, /source has 1 code listing\(s\) of 3 line\(s\) and 10 character\(s\), the output has 0/);
  assert.match(leaks, /source has 0 code listing\(s\) of 2 line\(s\) and 10 character\(s\), the output has 1/);
  assert.match(leaks, /source has 0 code listing\(s\) of 2 line\(s\) and 9 character\(s\), the output has 1/);
});

test('a listing truncated inside a line is a leak: same lines, fewer characters', () => {
  const html = LISTING('primo', '', '  ter') + LISTING('solo');
  assert.match(detectLeaks(report({ source: SOURCE_WITH_LISTINGS, chapters: [chapter(html)] })).join('\n'), /1 code listing\(s\) of 3 line\(s\) and 10 character\(s\), the output has 0/);
});

test('escaped characters in a listing count once, like the character they stand for', () => {
  const source = '\\chapter{Uno}\n\\begin{lstlisting}\na < b && c\n\\end{lstlisting}\n';
  assert.deepEqual(detectLeaks(report({ source, chapters: [chapter(LISTING('a &lt; b &amp;&amp; c'))] })), []);
});

test('a percent sign inside a listing is code, not a comment: its characters are all counted', () => {
  const source = '\\chapter{Uno}\n\\begin{lstlisting}\nif (x % 2 == 0) {\n\\end{lstlisting}\n';
  assert.deepEqual(detectLeaks(report({ source, chapters: [chapter(LISTING('if (x % 2 == 0) {'))] })), []);
  assert.match(detectLeaks(report({ source, chapters: [chapter(LISTING('if (x '))] })).join('\n'), /1 line\(s\) and 11 character\(s\)/);
});

test('quotes and blanks do not change what a listing weighs: LaTeXML curls the first and loses the second', () => {
  const source = "\\chapter{Uno}\n\\begin{lstlisting}\nx = 'a'   \n\\end{lstlisting}\n";
  assert.deepEqual(detectLeaks(report({ source, chapters: [chapter(LISTING('x = ‘a’'))] })), []);
});

test('a lstlisting that is never closed fails loudly instead of being measured against the rest of the file', () => {
  const source = '\\chapter{Uno}\n\\begin{lstlisting}\nprimo\n';
  assert.match(detectLeaks(report({ source, chapters: [chapter(LISTING('primo'))] })).join('\n'), /no \\end\{lstlisting\}/);
});

test('listings are compared however the source files are ordered: the book order is not the file order', () => {
  const html = LISTING('solo') + LISTING('primo', '', '  terzo');
  assert.deepEqual(detectLeaks(report({ source: SOURCE_WITH_LISTINGS, chapters: [chapter(html)] })), []);
});

test('commented-out listings are not counted, and a listing with no code has no lines', () => {
  const source = '\\chapter{Uno}\n% \\begin{lstlisting}\n% x\n% \\end{lstlisting}\n\\begin{lstlisting}\n\\end{lstlisting}\n';
  assert.deepEqual(detectLeaks(report({ source, chapters: [chapter(LISTING())] })), []);
});

const BOOK_SOURCE =
  '\\prefacesection{Ringraziamenti}\nGrazie.\n\\chapter{Uno}\n\\begin{thebibliography}{00}\n\\bibitem{a} A.\n\\bibitem{b} B.\n\\end{thebibliography}\n\\begin{appendices}\n\\chapter{Config}\n\\end{appendices}\n';
const page = (head: Partial<ConversionReport['chapters'][number]>, body = ''): ConversionReport['chapters'][number] => ({
  titolo: 'Pagina',
  html: `<div class="ltx_para"><p>${'testo '.repeat(20)}</p></div>${body}`,
  ...head,
});
const BIB_ITEMS = '<li class="ltx_bibitem">A.</li><li class="ltx_bibitem">B.</li>';
const BOOK = [
  page({ titolo: 'Ringraziamenti' }),
  page({ numero: 1, titolo: 'Uno' }),
  page({ titolo: 'Bibliografia', bibliografia: true }, BIB_ITEMS),
  page({ etichetta: 'Appendice A', titolo: 'Config' }),
];

test('acknowledgements, chapters, bibliography and appendices are each counted against their source', () => {
  assert.deepEqual(detectLeaks(report({ source: BOOK_SOURCE, chapters: BOOK })), []);
  assert.match(detectLeaks(report({ source: BOOK_SOURCE, chapters: BOOK.filter((p) => p.etichetta === undefined) })).join('\n'), /2 chapter.*1/);
  assert.match(detectLeaks(report({ source: BOOK_SOURCE, chapters: BOOK.filter((p) => p.titolo !== 'Ringraziamenti') })).join('\n'), /1 unnumbered.*0/);
  assert.match(detectLeaks(report({ source: BOOK_SOURCE, chapters: BOOK.filter((p) => p.bibliografia === undefined) })).join('\n'), /1 bibliography.*0/);
});

test('every \\bibitem of the source must come out as an entry of the bibliography', () => {
  const lost = BOOK.map((p) => (p.bibliografia ? { ...p, html: p.html.replace('<li class="ltx_bibitem">B.</li>', '') } : p));
  assert.match(detectLeaks(report({ source: BOOK_SOURCE, chapters: lost })).join('\n'), /2 bibliography entr.*1/);
});

test('a theorem environment that is only defined, never used, is not expected in the output', () => {
  const source = '\\newtheorem{myteor}{Teorema}[section]\n\\newenvironment{teor}{\\begin{myteor}\\sl}{\\end{myteor}}\n\\chapter{Uno}\nTesto.\n';
  assert.deepEqual(detectLeaks(report({ source })), []);
  const used = `${source}\\begin{myteor}Vero.\\end{myteor}\n`;
  assert.match(detectLeaks(report({ source: used })).join('\n'), /1 theorem-like.*0/);
});
