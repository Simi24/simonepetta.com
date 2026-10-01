import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { processChapter } from '../pipeline/latexml-chapter.ts';
import type { FigureAssets } from '../pipeline/figures.ts';

// Real LaTeXML 0.8.8 + BookML output, kept small. No Docker needed here.
const fixture = (name: string): string => readFileSync(new URL(`./fixtures/latexml/${name}`, import.meta.url), 'utf8');

const LINKS = { corso: 'gpucomputing', chapterSlugs: { 'Ch1.html': '1-introduzione' } };

const SIMT = 'images/simtvssimd.png';
const assets = (overrides: Partial<FigureAssets> = {}): FigureAssets => ({
  rasters: new Map([[SIMT, { name: 'images-simtvssimd.webp', width: 830, height: 316 }]]),
  tikz: [],
  alt: { [SIMT]: 'Due colonne a confronto: SIMD a sinistra, SIMT a destra.' },
  ...overrides,
});

test('a raster image becomes a lazy WebP with its dimensions, served from the course, with its own description', () => {
  const result = processChapter(fixture('gpu-Ch1.html'), LINKS, assets());
  const img = /<img [^>]*>/.exec(result.html)?.[0] ?? '';
  assert.match(img, /src="\/appunti\/gpucomputing\/figure\/images-simtvssimd\.webp"/);
  assert.match(img, /width="830"/);
  assert.match(img, /height="316"/);
  assert.match(img, /loading="lazy"/);
  assert.match(img, /alt="Due colonne a confronto: SIMD a sinistra, SIMT a destra\."/);
  assert.doesNotMatch(img, /Refer to caption|\.png/);
  assert.match(result.html, /<figcaption[^>]*>[\s\S]*Confronto tra SIMT e SIMD[\s\S]*<\/figcaption>/);
  assert.doesNotMatch(result.html, /figura-pending|in attesa/);
});

const COMPARATOR = readFileSync(new URL('./fixtures/figures/dvisvgm-comparator.svg', import.meta.url), 'utf8');
const TIKZ_KEY = 'img/pattern/c1.tex#1';
const tikzAssets = (alt: Record<string, string> = { [TIKZ_KEY]: 'Un comparatore con due ingressi.' }): FigureAssets =>
  assets({ tikz: [{ key: TIKZ_KEY, svg: COMPARATOR }], alt });

test('a TikZ picture becomes the compiled inline SVG, black rewritten to currentColor so it follows both themes', () => {
  const result = processChapter(fixture('gpu-Ch7-tikz-picture.html'), LINKS, tikzAssets());
  const svg = /<svg[\s\S]*<\/svg>/.exec(result.html)?.[0] ?? '';
  assert.match(svg, /^<svg [^>]*role="img"/);
  assert.match(svg, /aria-label="Un comparatore con due ingressi\."/);
  assert.match(svg, /currentColor/);
  assert.doesNotMatch(svg, /#000|black|<\?xml|<!--/);
  assert.doesNotMatch(result.html, /figura-pending|in attesa|bml_fill|foreignObject/);
  assert.match(result.html, /<figcaption/);
});

test('the SVG ids of different pictures on a page never collide', () => {
  const page = fixture('gpu-Ch7-tikz-picture.html');
  const one = processChapter(page, LINKS, tikzAssets()).html;
  const other = processChapter(page, LINKS, assets({ tikz: [{ key: 'img/pattern/c2.tex#1', svg: COMPARATOR }], alt: { 'img/pattern/c2.tex#1': 'x' } })).html;
  const ids = (html: string): string[] => [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]!).filter((id) => /-g\d-/.test(id));
  assert.ok(ids(one).length > 0);
  assert.deepEqual(ids(one).filter((id) => ids(other).includes(id)), []);
  assert.doesNotMatch(one, /href="#g\d/);
});

test('more pictures in the page than compiled ones is an error, never a silent drop', () => {
  assert.throws(() => processChapter(fixture('gpu-Ch7-tikz-picture.html'), LINKS, assets()), /TikZ/);
});
