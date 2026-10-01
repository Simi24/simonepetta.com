import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { processChapter, readChapterHead } from '../pipeline/latexml-chapter.ts';

// Real LaTeXML 0.8.8 + BookML output (pipeline/Dockerfile), kept small. No Docker needed here.
const fixture = (name: string): string => readFileSync(new URL(`./fixtures/latexml/${name}`, import.meta.url), 'utf8');

const LINKS = { corso: 'gpucomputing', chapterSlugs: { 'Ch1.html': '1-introduzione', 'Ch2.html': '2-modello-di-programmazione-cuda' } };

// gpu-Ch1.html has one raster figure; these tests are about something else.
const GPU_CH1_FIGURES = {
  rasters: new Map([['images/simtvssimd.png', { name: 'images-simtvssimd.webp', width: 830, height: 316 }]]),
  tikz: [],
  alt: { 'images/simtvssimd.png': 'Confronto fra SIMD e SIMT.' },
};

test('reads the chapter number and title from the chapter heading', () => {
  assert.deepEqual(readChapterHead(fixture('mini-Ch1.html')), { numero: 1, titolo: 'Variabili aleatorie continue' });
  assert.deepEqual(readChapterHead(fixture('gpu-Ch1.html')), { numero: 1, titolo: 'Introduzione' });
});

test('throws on a page with no chapter rather than guessing one', () => {
  assert.throws(() => readChapterHead('<html><body><p>niente</p></body></html>'));
});

test('lists the numbered sections of the chapter for its table of contents', () => {
  const { sezioni } = processChapter(fixture('mini-Ch1.html'), LINKS);
  assert.deepEqual(sezioni, [
    { id: 'S1', numero: '1.1', titolo: 'Densità', sottosezioni: [] },
    { id: 'S2', numero: '1.2', titolo: 'Allineamenti', sottosezioni: [] },
  ]);
});

test('subsections are listed under their section', () => {
  const { sezioni } = processChapter(fixture('gpu-Ch1.html'), LINKS, GPU_CH1_FIGURES);
  const eterogenee = sezioni.find((sezione) => sezione.id === 'S2');
  assert.deepEqual(eterogenee?.sottosezioni, [
    { id: 'S2.SS1', numero: '1.2.1', titolo: 'Parallelismo delle istruzioni' },
    { id: 'S2.SS2', numero: '1.2.2', titolo: 'Parallelismo dei dati' },
  ]);
  assert.deepEqual(sezioni.find((sezione) => sezione.id === 'S3')?.sottosezioni, []);
});

test('the fragment is the chapter body only: no page chrome, no heading, no script', () => {
  const { html } = processChapter(fixture('gpu-Ch1.html'), LINKS, GPU_CH1_FIGURES);
  assert.doesNotMatch(html, /<(html|head|body|script|nav|header|h1|link|button)[\s>]/);
  assert.doesNotMatch(html, /onclick=|data:|\sstyle=/);
  assert.match(html, /L’obiettivo del corso/);
  assert.match(html, /<h2[^>]*>[\s\S]*GP-GPU<\/h2>/);
});

test('math stays native MathML, without the TeX annotation, and the chapter is flagged as having math', () => {
  const { html, hasMath } = processChapter(fixture('mini-Ch1.html'), LINKS);
  assert.equal(hasMath, true);
  assert.match(html, /<math[^>]*alttext="f\\geq 0"[^>]*>/);
  assert.doesNotMatch(html, /<annotation/);
  assert.doesNotMatch(html, /MathJax/i);
});

test('a chapter with no math is flagged as such', () => {
  const { hasMath } = processChapter(fixture('mini-Ch2.html'), LINKS);
  assert.equal(hasMath, false);
});

test('theorems, proofs and numbered equations keep the structure the stylesheet hangs on', () => {
  const { html } = processChapter(fixture('mini-Ch1.html'), LINKS);
  assert.match(html, /class="ltx_theorem ltx_theorem_theorem"/);
  assert.match(html, /Teorema 1\.2<\/span><\/span><span class="ltx_text ltx_font_bold"> <\/span>\(Disuguaglianza di Čebyšëv\)/);
  assert.match(html, /class="ltx_proof"/);
  assert.match(html, /class="ltx_equation bml_equation/);
});

test('an equation number is announced once: the visible duplicate is hidden from screen readers', () => {
  const { html } = processChapter(fixture('mini-Ch1.html'), LINKS);
  assert.match(html, /<span class="ltx_tag ltx_tag_equation ltx_eqn_eqno" id="bml-auto-id3"><span class="bml_sr_only">equation <\/span>\(1\.1\)<\/span>/);
  assert.match(html, /<span class="ltx_tag ltx_tag_equation ltx_eqn_eqno" aria-hidden="true">\(1\.1\)<\/span>/);
});

test('a code listing becomes plain preformatted text: source indentation kept, no inline colors or buttons', () => {
  const { html } = processChapter(fixture('gpu-Ch1.html'), LINKS, GPU_CH1_FIGURES);
  assert.match(html, /<pre class="listing" tabindex="0"><code>/);
  assert.match(
    html,
    /<span class="ltx_listingline">    __global__ void hello_world\(\) \{<\/span>\n<span class="ltx_listingline">        printf\("Hello, World from GPU!\\n"\);<\/span>/,
  );
  assert.doesNotMatch(html, /ltx_lst_keyword|bml_color_|copy code/);
});

test('an algorithm keeps its math and its nesting rules', () => {
  const { html } = processChapter(fixture('gpu-Ch7-algorithm-table.html'), LINKS);
  assert.match(html, /<math[^>]*alttext="S\\leftarrow\\emptyset"/);
  assert.match(html, /class="ltx_rule bml_vrule bml_algo_rule"/);
});

test('links to other chapters point at the site URLs, and in-page links are kept', () => {
  const page = fixture('mini-Ch1.html').replace('href="#Thmtheorem2"', 'href="Ch2.html#Thmtheorem2"');
  const { html } = processChapter(page, LINKS);
  assert.match(html, /href="\/appunti\/gpucomputing\/2-modello-di-programmazione-cuda\/#Thmtheorem2"/);
  assert.doesNotMatch(html, /href="Ch\d+\.html/);
  assert.match(processChapter(fixture('mini-Ch1.html'), LINKS).html, /href="#Thmtheorem2"/);
});

test('a link the pipeline cannot resolve fails the conversion instead of shipping dead', () => {
  const page = fixture('mini-Ch1.html').replace('href="#Thmtheorem2"', 'href="Ch9.html#x"');
  assert.throws(() => processChapter(page, LINKS), /Ch9\.html/);
});

test('tables keep their cell borders and alignment classes', () => {
  const { html } = processChapter(fixture('gpu-Ch7-algorithm-table.html'), LINKS);
  assert.match(html, /<td class="ltx_td ltx_align_right ltx_border_r">/);
});

test('a tcolorbox keeps its content and its title, which becomes a heading; the pipeline markers are gone', () => {
  const result = processChapter(fixture('tcolorbox-Ch1.html'), LINKS);
  assert.equal(result.tcolorboxes, 3);
  assert.deepEqual(result.tcolorboxTitles, ['Il mio titolo', 'Altro, con virgola']);
  assert.match(result.html, /<p class="ltx_p tcbtitle">Il mio <span class="ltx_text ltx_font_bold">titolo<\/span><\/p>/);
  assert.match(result.html, /Solo testo nel box\./);
  assert.match(result.html, /<math[^>]*alttext="x\\leftarrow 1"/);
  assert.doesNotMatch(result.html, /class="ltx_text tcolorbox"/);
  assert.doesNotMatch(result.html, /<p class="ltx_p">\s*<\/p>/);
});

test('a paragraph block left empty by a removed marker is dropped too', () => {
  const page = fixture('mini-Ch2.html').replace('<div id="p1"', '<div id="empty" class="ltx_para">\n\n</div>\n<div id="p1"');
  assert.match(page, /id="empty"/);
  assert.doesNotMatch(processChapter(page, LINKS).html, /id="empty"/);
});

/** The numbers shown in the margin of the first listing in `html`, in order. */
const lineNumbers = (html: string): string[] =>
  [...html.matchAll(/<span class="ltx_tag ltx_tag_listingline">(\d+)<\/span>/g)].map((match) => match[1]!);

test('algorithm lines are numbered like the PDF: the empty lines that close a block take no number', () => {
  const { html } = processChapter(fixture('gpu-Ch7-algorithm-table.html'), LINKS);
  assert.deepEqual(lineNumbers(html), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']);
  assert.match(html, /<math[^>]*alttext="R\\leftarrow R-\\\{v\\\}"/);
});

test('listing captions are numbered per chapter like the PDF: Listing 7.1, 7.2', () => {
  const { html } = processChapter(fixture('gpu-Ch7-listing-caption.html'), LINKS);
  const captions = [...html.matchAll(/<span class="ltx_tag ltx_tag_float">([^<]*)<\/span>/g)].map((match) => match[1]);
  assert.deepEqual(captions, ['Listing\u00a07.1: ', 'Listing\u00a07.2: ']);
});

test('a tabular inside a paragraph keeps its line without nesting tables in a <p>', () => {
  const { html } = processChapter(fixture('gpu-Ch8-tabular-in-paragraph.html'), LINKS);
  assert.doesNotMatch(html, /<p\b[^>]*>(?:(?!<\/p>)[\s\S])*<table/);
  const lines = [...html.matchAll(/<div class="[^"]*\bltx_inline_tabulars\b[^"]*">([\s\S]*?)<\/div>\n/g)].map((match) => match[1]!);
  assert.equal(lines.length, 2);
  for (const line of lines) {
    // table · table = table, in this order, inside one container
    assert.deepEqual([...line.matchAll(/<table\b|alttext="([^"]*)"/g)].map((match) => match[1] ?? 'table'), ['table', '\\cdot', 'table', '=', 'table']);
  }
});

/** A display equation of `tokens` symbols, as LaTeXML writes it (its TeX annotation included). */
const displayMath = (id: string, tokens: number): string =>
  `<math id="${id}" class="ltx_Math" alttext="x" display="block"><semantics><mrow>${'<mi>x</mi>'.repeat(tokens)}</mrow><annotation encoding="application/x-tex">x</annotation></semantics></math>`;

test('a display equation wide enough to scroll can be reached with the keyboard, a short one adds no tab stop', () => {
  const page = fixture('mini-Ch2.html').replace('<div id="p1"', `<div id="eq">${displayMath('long', 60)}${displayMath('short', 5)}</div>\n<div id="p1"`);
  const { html } = processChapter(page, LINKS);
  assert.match(html, /<math id="long"[^>]*tabindex="0"/);
  assert.doesNotMatch(html, /<math id="short"[^>]*tabindex/);
});
