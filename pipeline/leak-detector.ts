import { attribute, elementEnd, hasClass, serialize, tokenize } from './html-tokens.ts';
import { MAX_RASTER_WIDTH } from './figures.ts';

/**
 * The leak detector (SPEC.md §7.5): conversion fails silently, so the source is compared with
 * the output on everything that can vanish without an error. Any leak fails the conversion and
 * `build/` is not updated. Figures are counted exactly (`\includegraphics` against images,
 * `tikzpicture` against SVGs) and each one must carry a description.
 */

export interface ReportedChapter {
  numero: number;
  titolo: string;
  html: string;
  tcolorboxes?: number;
  tcolorboxTitles?: readonly string[];
}

export interface ConversionReport {
  /** Every `.tex` file of the course's `src/`, concatenated. */
  source: string;
  chapters: readonly ReportedChapter[];
  /** From LaTeXML's own log ("Conversion complete: N errors"). */
  latexmlErrors: number;
  /** Files LaTeXML wrote that are neither `index.html` nor a `ChN.html` chapter. */
  extraOutputFiles: readonly string[];
  /** The files of `build/figure/` the pipeline produced. */
  figureFiles: readonly string[];
}

const MIN_CHAPTER_HTML_LENGTH = 40;

/** The source without TeX comments (`%` to end of line, but not `\%`). */
const withoutComments = (source: string): string => source.replace(/(^|[^\\])%.*$/gm, '$1');

const count = (text: string, pattern: RegExp): number => text.match(pattern)?.length ?? 0;

function theoremNames(source: string): string[] {
  return [...source.matchAll(/\\newtheorem\*?\{([^}]+)\}/g)].map((match) => match[1]!);
}

/**
 * Top-level display equations in a chapter: an aligned group is one equation however many rows
 * it has, so rows inside a group are not counted again.
 */
export function countDisplayEquations(html: string): number {
  const tokens = tokenize(html);
  let total = 0;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.type !== 'open' || (!hasClass(token, 'ltx_equation') && !hasClass(token, 'ltx_equationgroup'))) continue;
    total++;
    if (hasClass(token, 'ltx_equationgroup')) i = elementEnd(tokens, i);
  }
  return total;
}

/** The `title=` of each `\begin{tcolorbox}[...]` in the source, braces balanced. */
function tcolorboxTitlesInSource(source: string): string[] {
  const titles: string[] = [];
  for (const match of source.matchAll(/\\begin\{tcolorbox\}\s*\[/g)) {
    let depth = 0;
    let end = match.index + match[0].length;
    for (; end < source.length; end++) {
      const char = source[end];
      if (char === '{') depth++;
      else if (char === '}') depth--;
      else if (char === ']' && depth === 0) break;
    }
    const options = source.slice(match.index + match[0].length, end);
    const title = /(?:^|,)\s*title\s*=\s*(\{(?:[^{}]|\{[^{}]*\})*\}|[^,]*)/.exec(options)?.[1];
    if (title !== undefined) titles.push(title.replace(/^\{(.*)\}$/s, '$1').trim());
  }
  return titles;
}

/** The title as plain words, or `undefined` when it has math or macros beyond simple font switches (only the count is checked then). */
function plainWords(title: string): string | undefined {
  const stripped = title.replace(/\\(?:bf|it|em|sc|tt|textbf|textit|emph|texttt)\b/g, '').replace(/[{}]/g, '');
  return /[\\$]/.test(stripped) ? undefined : stripped.replace(/\s+/g, ' ').trim();
}

function describeMismatch(label: string, expected: number, actual: number, relation: 'exactly' | 'at least'): string | undefined {
  const fine = relation === 'exactly' ? expected === actual : actual >= expected;
  return fine ? undefined : `the source has ${expected} ${label}, the output ${relation === 'exactly' ? 'has' : 'has only'} ${actual}`;
}

const lastSegment = (path: string): string => path.slice(path.lastIndexOf('/') + 1);

/** What is wrong with the figures of the output: images and SVGs, each with its description. */
function figureLeaks(chapters: readonly ReportedChapter[], figureFiles: readonly string[]): { images: number; svgs: number; leaks: string[] } {
  const leaks: string[] = [];
  let images = 0;
  let svgs = 0;
  for (const chapter of chapters) {
    const tokens = tokenize(chapter.html);
    tokens.forEach((token, i) => {
      if (token.type !== 'open') return;
      if (token.name === 'img') {
        images++;
        const name = lastSegment(attribute(token, 'src') ?? '');
        if ((attribute(token, 'alt') ?? '').trim() === '') leaks.push(`the image ${name} has no description (alt text)`);
        if (!name.endsWith('.webp')) leaks.push(`the image ${name} is not a WebP`);
        if (!figureFiles.includes(name)) leaks.push(`the image ${name} is not among the produced files`);
        const width = Number(attribute(token, 'width'));
        if (!(width > 0)) leaks.push(`the image ${name} has no width`);
        if (width > MAX_RASTER_WIDTH) leaks.push(`the image ${name} is wider than ${MAX_RASTER_WIDTH} px`);
        if (!(Number(attribute(token, 'height')) > 0)) leaks.push(`the image ${name} has no height`);
        if (attribute(token, 'loading') !== 'lazy') leaks.push(`the image ${name} is not lazy loaded`);
      } else if (token.name === 'svg') {
        svgs++;
        if ((attribute(token, 'aria-label') ?? '').trim() === '') leaks.push('a TikZ picture has no description (aria-label)');
        if (/#000\b|\bblack\b/.test(serialize(tokens.slice(i, elementEnd(tokens, i) + 1)))) {
          leaks.push('a TikZ picture keeps hard black instead of currentColor');
        }
      }
    });
  }
  return { images, svgs, leaks };
}

export function detectLeaks(report: ConversionReport): string[] {
  const source = withoutComments(report.source);
  const output = report.chapters.map((chapter) => chapter.html).join('\n');
  const leaks: string[] = [];
  const check = (message: string | undefined): void => {
    if (message !== undefined) leaks.push(message);
  };

  if (report.latexmlErrors > 0) leaks.push(`LaTeXML reported ${report.latexmlErrors} error(s) (see its log)`);

  for (const file of report.extraOutputFiles) leaks.push(`LaTeXML wrote ${file}, which the pipeline does not convert`);

  for (const chapter of report.chapters) {
    if (chapter.html.length < MIN_CHAPTER_HTML_LENGTH) leaks.push(`chapter ${chapter.numero} "${chapter.titolo}" is empty`);
  }

  check(describeMismatch('chapter(s)', count(source, /\\chapter\s*[{[]/g), report.chapters.length, 'exactly'));

  const figures = figureLeaks(report.chapters, report.figureFiles);
  check(describeMismatch('image(s) (\\includegraphics)', count(source, /\\includegraphics\b/g), figures.images, 'exactly'));
  check(describeMismatch('TikZ picture(s) (tikzpicture)', count(source, /\\begin\{tikzpicture\}/g), figures.svgs, 'exactly'));
  leaks.push(...figures.leaks);

  const theorems = theoremNames(source).reduce(
    (sum, name) => sum + count(source, new RegExp(`\\\\begin\\{${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'g')),
    0,
  );
  check(describeMismatch('theorem-like environment(s)', theorems, count(output, /class="ltx_theorem /g), 'exactly'));
  check(describeMismatch('proof(s)', count(source, /\\begin\{proof\}/g), count(output, /class="ltx_proof"/g), 'exactly'));

  const equations =
    count(source, /\\begin\{(?:equation|align|alignat|flalign|gather|multline|eqnarray)\*?\}/g) +
    count(source, /\\\[/g) +
    Math.floor(count(source, /\$\$/g) / 2);
  const outputEquations = report.chapters.reduce((sum, chapter) => sum + countDisplayEquations(chapter.html), 0);
  check(describeMismatch('display equation(s)', equations, outputEquations, 'exactly'));

  const boxes = count(source, /\\begin\{tcolorbox\}/g);
  check(describeMismatch('tcolorbox(es)', boxes, report.chapters.reduce((sum, chapter) => sum + (chapter.tcolorboxes ?? 0), 0), 'exactly'));
  const sourceTitles = tcolorboxTitlesInSource(source);
  const outputTitles = report.chapters.flatMap((chapter) => chapter.tcolorboxTitles ?? []);
  check(describeMismatch('tcolorbox title(s)', sourceTitles.length, outputTitles.length, 'exactly'));
  for (const title of sourceTitles) {
    const plain = plainWords(title);
    if (plain !== undefined && !outputTitles.some((out) => out.replace(/\s+/g, ' ') === plain)) {
      leaks.push(`the tcolorbox title "${plain}" of the source is not in the output`);
    }
  }

  const markers = new Map<string, number>();
  for (const match of output.matchAll(/ltx_ERROR|ltx_missing[\w-]*/g)) markers.set(match[0], (markers.get(match[0]) ?? 0) + 1);
  for (const [marker, n] of markers) leaks.push(`the output contains ${n} ${marker} marker(s): LaTeXML could not resolve something`);

  return leaks;
}
