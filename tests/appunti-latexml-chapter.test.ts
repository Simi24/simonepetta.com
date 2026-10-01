import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { processChapter, readChapterHead } from '../pipeline/latexml-chapter.ts';

// Real LaTeXML 0.8.8 + BookML output (pipeline/Dockerfile), kept small. No Docker needed here.
const fixture = (name: string): string => readFileSync(new URL(`./fixtures/latexml/${name}`, import.meta.url), 'utf8');

const LINKS = { corso: 'gpucomputing', chapterSlugs: { 'Ch1.html': '1-introduzione', 'Ch2.html': '2-modello-di-programmazione-cuda' } };

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
  const { sezioni } = processChapter(fixture('gpu-Ch1.html'), LINKS);
  const eterogenee = sezioni.find((sezione) => sezione.id === 'S2');
  assert.deepEqual(eterogenee?.sottosezioni, [
    { id: 'S2.SS1', numero: '1.2.1', titolo: 'Parallelismo delle istruzioni' },
    { id: 'S2.SS2', numero: '1.2.2', titolo: 'Parallelismo dei dati' },
  ]);
  assert.deepEqual(sezioni.find((sezione) => sezione.id === 'S3')?.sottosezioni, []);
});

test('the fragment is the chapter body only: no page chrome, no heading, no script', () => {
  const { html } = processChapter(fixture('gpu-Ch1.html'), LINKS);
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
  const { html } = processChapter(fixture('gpu-Ch1.html'), LINKS);
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

test('a figure is marked as pending, with its caption kept, never silently dropped', () => {
  const result = processChapter(fixture('gpu-Ch1.html'), LINKS);
  assert.doesNotMatch(result.html, /<img[\s>]/);
  assert.equal(result.figurePending, 1);
  assert.match(result.html, /<p class="figura-pending">Figura in attesa di conversione\.<\/p>/);
  assert.match(result.html, /<figcaption[^>]*>[\s\S]*Figure 1\.1[\s\S]*<\/figcaption>/);
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

test('a TikZ picture LaTeXML drew as inline SVG is marked pending too: its colors are hard black, unusable in the dark theme', () => {
  const result = processChapter(fixture('gpu-Ch7-tikz-picture.html'), LINKS);
  assert.doesNotMatch(result.html, /<svg|stroke=|fill="#/);
  assert.equal(result.figurePending, 1);
  assert.match(result.html, /Figura in attesa di conversione/);
  assert.match(result.html, /<figcaption/);
});
