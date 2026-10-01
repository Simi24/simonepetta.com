/**
 * The leak detector (SPEC.md §7.5): conversion fails silently, so the source is compared with
 * the output on everything that can vanish without an error. Any leak fails the conversion and
 * `build/` is not updated. Alt text on figures is checked once figures are converted (#37);
 * until then every figure is a visible "pending" marker, counted here against the source.
 */

export interface ReportedChapter {
  numero: number;
  titolo: string;
  html: string;
  figurePending: number;
}

export interface ConversionReport {
  /** Every `.tex` file of the course's `src/`, concatenated. */
  source: string;
  chapters: readonly ReportedChapter[];
  /** From LaTeXML's own log ("Conversion complete: N errors"). */
  latexmlErrors: number;
  /** Files LaTeXML wrote that are neither `index.html` nor a `ChN.html` chapter. */
  extraOutputFiles: readonly string[];
}

const MIN_CHAPTER_HTML_LENGTH = 40;

/** The source without TeX comments (`%` to end of line, but not `\%`). */
const withoutComments = (source: string): string => source.replace(/(^|[^\\])%.*$/gm, '$1');

const count = (text: string, pattern: RegExp): number => text.match(pattern)?.length ?? 0;

function theoremNames(source: string): string[] {
  return [...source.matchAll(/\\newtheorem\*?\{([^}]+)\}/g)].map((match) => match[1]!);
}

function describeMismatch(label: string, expected: number, actual: number, relation: 'exactly' | 'at least'): string | undefined {
  const fine = relation === 'exactly' ? expected === actual : actual >= expected;
  return fine ? undefined : `the source has ${expected} ${label}, the output ${relation === 'exactly' ? 'has' : 'has only'} ${actual}`;
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

  const figures = count(source, /\\includegraphics\b/g) + count(source, /\\begin\{tikzpicture\}/g);
  const pending = report.chapters.reduce((sum, chapter) => sum + chapter.figurePending, 0);
  check(describeMismatch('figure(s) (\\includegraphics, tikzpicture)', figures, pending, 'exactly'));

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
  check(describeMismatch('display equation(s)', equations, count(output, /class="ltx_equation(?:group)?[ "]/g), 'at least'));

  const markers = new Map<string, number>();
  for (const match of output.matchAll(/ltx_ERROR|ltx_missing[\w-]*/g)) markers.set(match[0], (markers.get(match[0]) ?? 0) + 1);
  for (const [marker, n] of markers) leaks.push(`the output contains ${n} ${marker} marker(s): LaTeXML could not resolve something`);

  return leaks;
}
