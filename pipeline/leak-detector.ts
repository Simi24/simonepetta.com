import { attribute, elementEnd, hasClass, serialize, tokenize } from './html-tokens.ts';
import { MAX_RASTER_WIDTH } from './figures.ts';

/**
 * The leak detector (SPEC.md §7.5): conversion fails silently, so the source is compared with
 * the output on everything that can vanish without an error. Any leak fails the conversion and
 * `build/` is not updated. Figures are counted exactly (`\includegraphics` against images,
 * `tikzpicture` against SVGs) and each one must carry a description.
 */

export interface ReportedChapter {
  /** A numbered chapter. */
  numero?: number | undefined;
  /** A lettered appendix. A page with neither is unnumbered; the bibliography is flagged. */
  etichetta?: string | undefined;
  bibliografia?: boolean | undefined;
  titolo: string;
  html: string;
  /** Absent when the output no longer records them (a committed `build/`): the box checks are then skipped. */
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

/** The source without the bodies of `\\newenvironment`: `\\begin{theorem}` inside one is a definition, not a use. */
function withoutEnvironmentDefinitions(source: string): string {
  let out = '';
  let from = 0;
  for (const match of source.matchAll(/\\(?:re)?newenvironment\*?\s*\{[^}]*\}(?:\s*\[[^\]]*\])*/g)) {
    if (match.index < from) continue;
    let end = match.index + match[0].length;
    for (let groups = 0; groups < 2; groups++) {
      while (/\s/.test(source[end] ?? '')) end++;
      if (source[end] !== '{') break;
      let depth = 0;
      do {
        if (source[end] === '{') depth++;
        else if (source[end] === '}') depth--;
        end++;
      } while (depth > 0 && end < source.length);
    }
    out += source.slice(from, match.index);
    from = end;
  }
  return out + source.slice(from);
}

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

/**
 * Not counted in a listing: blanks (listings expands a tab by its own tab size, wherever it is in the line, and LaTeXML
 * drops trailing blanks) and quotes (LaTeXML curls them, the pipeline puts them back, and when a string is left open
 * on a line it closes it with one more, which the PDF does not show).
 */
const UNCOUNTED = /[\s'\u2018\u2019`]/g;

/** A listing's size: its lines and the characters on them that count, so a line cut short is seen too. */
interface ListingSize {
  lines: number;
  characters: number;
}

/**
 * The size of each `lstlisting` of the raw source (a `%` inside one is code, so comments are not stripped first),
 * and how many are never closed: the option block and the line holding `\\end` are not code.
 */
function listingsInSource(source: string): { sizes: ListingSize[]; unclosed: number } {
  const sizes: ListingSize[] = [];
  let unclosed = 0;
  for (const match of source.matchAll(/\\begin\{lstlisting\}/g)) {
    const lineStart = source.lastIndexOf('\n', match.index) + 1;
    if (withoutComments(source.slice(lineStart, match.index)) !== source.slice(lineStart, match.index)) continue;
    let start = match.index + match[0].length;
    if (source[start] === '[') {
      let depth = 0;
      for (; start < source.length; start++) {
        if (source[start] === '{') depth++;
        else if (source[start] === '}') depth--;
        else if (source[start] === ']' && depth === 0) break;
      }
      start++;
    }
    const end = source.indexOf('\\end{lstlisting}', start);
    if (end < 0) {
      unclosed++;
      continue;
    }
    const code = source.slice(start, end);
    // The rest of the `\\begin` line is not code, and neither is the indentation before `\\end`.
    const body = code.includes('\n') ? code.slice(code.indexOf('\n') + 1).replace(/\n?[ \t]*$/, '') : '';
    const lines = body === '' ? [] : body.split('\n');
    sizes.push({ lines: lines.length, characters: lines.reduce((total, line) => total + [...line.replace(UNCOUNTED, '')].length, 0) });
  }
  return { sizes, unclosed };
}

const unescapeHtml = (text: string): string =>
  text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0*39;/g, "'").replace(/&amp;/g, '&');

/** The size of each code listing of the output (`<pre class="listing">`), in order. */
function listingsInOutput(html: string): ListingSize[] {
  return [...html.matchAll(/<pre class="listing"[^>]*>([\s\S]*?)<\/pre>/g)].map((match) => {
    const lines = [...match[1]!.matchAll(/<span class="ltx_listingline">([^<]*)<\/span>/g)].map((line) => unescapeHtml(line[1]!));
    return { lines: lines.length, characters: lines.reduce((total, line) => total + [...line.replace(UNCOUNTED, '')].length, 0) };
  });
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
  const source = withoutEnvironmentDefinitions(withoutComments(report.source));
  const output = report.chapters.map((chapter) => chapter.html).join('\n');
  const leaks: string[] = [];
  const check = (message: string | undefined): void => {
    if (message !== undefined) leaks.push(message);
  };

  if (report.latexmlErrors > 0) leaks.push(`LaTeXML reported ${report.latexmlErrors} error(s) (see its log)`);

  for (const file of report.extraOutputFiles) leaks.push(`LaTeXML wrote ${file}, which the pipeline does not convert`);

  const isBibliography = (chapter: ReportedChapter): boolean => chapter.bibliografia === true;
  const isUnnumbered = (chapter: ReportedChapter): boolean => !isBibliography(chapter) && chapter.numero === undefined && chapter.etichetta === undefined;
  const nameOf = (chapter: ReportedChapter): string => {
    if (isBibliography(chapter)) return `bibliography "${chapter.titolo}"`;
    if (chapter.etichetta !== undefined) return `appendix "${chapter.etichetta}: ${chapter.titolo}"`;
    return chapter.numero === undefined ? `unnumbered page "${chapter.titolo}"` : `chapter ${chapter.numero} "${chapter.titolo}"`;
  };
  for (const chapter of report.chapters) {
    if (chapter.html.length < MIN_CHAPTER_HTML_LENGTH) leaks.push(`${nameOf(chapter)} is empty`);
  }
  check(describeMismatch('chapter(s)', count(source, /\\chapter\s*[{[]/g), report.chapters.filter((c) => !isBibliography(c) && !isUnnumbered(c)).length, 'exactly'));
  check(
    describeMismatch('unnumbered page(s) (\\chapter*, \\prefacesection)', count(source, /\\(?:chapter\*|prefacesection)\s*\{/g), report.chapters.filter(isUnnumbered).length, 'exactly'),
  );
  check(
    describeMismatch('bibliography(ies)', count(source, /\\begin\{thebibliography\}|\\bibliography\s*\{/g), report.chapters.filter(isBibliography).length, 'exactly'),
  );
  check(describeMismatch('bibliography entry(ies) (\\bibitem)', count(source, /\\bibitem\b/g), count(output, /class="ltx_bibitem"/g), 'exactly'));

  const { sizes: sourceListings, unclosed } = listingsInSource(report.source);
  if (unclosed > 0) leaks.push(`the source has ${unclosed} \\begin{lstlisting} with no \\end{lstlisting}: its listings cannot be checked`);
  const outputListings = report.chapters.flatMap((chapter) => listingsInOutput(chapter.html));
  check(describeMismatch('code listing(s) (lstlisting)', sourceListings.length, outputListings.length, 'exactly'));
  // The source files are not in book order, so listings are compared as a multiset of (lines, characters), not by position.
  const sizeKey = (size: ListingSize): string => `${size.lines} line(s) and ${size.characters} character(s)`;
  const sourceKeys = sourceListings.map(sizeKey);
  const outputKeys = outputListings.map(sizeKey);
  for (const key of new Set([...sourceKeys, ...outputKeys])) {
    const expected = sourceKeys.filter((k) => k === key).length;
    const produced = outputKeys.filter((k) => k === key).length;
    if (expected !== produced) leaks.push(`the source has ${expected} code listing(s) of ${key}, the output has ${produced}`);
  }

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

  // A committed `build/` no longer records the boxes (the pipeline strips its markers): then only a conversion can check them.
  if (report.chapters.some((chapter) => chapter.tcolorboxes !== undefined)) {
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
  }

  const markers = new Map<string, number>();
  for (const match of output.matchAll(/ltx_ERROR|ltx_missing[\w-]*/g)) markers.set(match[0], (markers.get(match[0]) ?? 0) + 1);
  for (const [marker, n] of markers) leaks.push(`the output contains ${n} ${marker} marker(s): LaTeXML could not resolve something`);

  return leaks;
}
