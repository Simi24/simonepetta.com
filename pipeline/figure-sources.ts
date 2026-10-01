import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Reads the course's `.tex` sources for the TikZ pictures (SPEC.md §7.4). LaTeXML draws them as
 * inline SVG with hard black strokes, so each one is compiled again on its own, in the
 * container, to a clean SVG. The pictures are matched to LaTeXML's by order, so they are found
 * the way TeX meets them: `\include` and `\input` are followed where they stand.
 */

export interface TikzSource {
  /** The file the picture is in, and which picture of that file it is (`img/up.tex#1`): what `alt.json` is keyed by. */
  key: string;
  code: string;
}

const MAIN = 'main';

const withoutComments = (text: string): string => text.replace(/(^|[^\\])%.*$/gm, '$1');

const TOKEN = /\\(?:input|include)\{([^}]+)\}|\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/g;

function walk(srcDir: string, file: string, out: TikzSource[], trail: readonly string[]): void {
  if (trail.includes(file)) throw new Error(`${file} includes itself (${[...trail, file].join(' -> ')})`);
  const path = join(srcDir, file);
  if (!existsSync(path)) throw new Error(`the source includes "${file.replace(/\.tex$/, '')}", but ${file} does not exist`);
  let inFile = 0;
  for (const match of withoutComments(readFileSync(path, 'utf8')).matchAll(TOKEN)) {
    const [text, included] = match;
    if (included !== undefined) walk(srcDir, included.endsWith('.tex') ? included : `${included}.tex`, out, [...trail, file]);
    else out.push({ key: `${file}#${++inFile}`, code: text });
  }
}

/** Every `tikzpicture` of the course, in document order. */
export function findTikz(srcDir: string): TikzSource[] {
  const out: TikzSource[] = [];
  walk(srcDir, `${MAIN}.tex`, out, []);
  return out;
}

const SAFE_PACKAGES = new Set(['amsmath', 'amssymb', 'amsfonts', 'mathtools', 'bm', 'xcolor', 'tikz', 'pgfplots', 'fontenc', 'inputenc', 'siunitx']);
const SAFE_COMMANDS = /^\\(?:usetikzlibrary|tikzset|pgfplotsset|newcommand|renewcommand|providecommand|DeclareMathOperator|definecolor|NewDocumentCommand|def)\b/;

function keepsInPreamble(line: string): boolean {
  const packages = /^\\usepackage(?:\[[^\]]*\])?\{([^}]*)\}/.exec(line)?.[1];
  if (packages !== undefined) return packages.split(',').every((name) => SAFE_PACKAGES.has(name.trim()));
  return SAFE_COMMANDS.test(line);
}

/**
 * A `standalone` document for one picture. Its preamble is the course's own, cut down to what a
 * figure needs (math and drawing packages, TikZ libraries, macros): the page setup, hyperref and
 * the like are dropped. A figure that needs more fails to compile, which fails the conversion.
 * Macros must be on one line each.
 */
export function tikzDocument(srcDir: string, tikz: TikzSource): string {
  const main = withoutComments(readFileSync(join(srcDir, `${MAIN}.tex`), 'utf8'));
  const preamble = main.slice(0, main.indexOf('\\begin{document}')).split('\n').map((line) => line.trim());
  const documentClass = preamble.find((line) => line.startsWith('\\documentclass')) ?? '';
  const size = /\b\d+pt\b/.exec(/^\\documentclass\[([^\]]*)\]/.exec(documentClass)?.[1] ?? '')?.[0];
  return [
    `\\documentclass[dvisvgm${size === undefined ? '' : `,${size}`}]{standalone}`,
    ...preamble.filter(keepsInPreamble),
    '\\begin{document}',
    tikz.code,
    '\\end{document}',
    '',
  ].join('\n');
}
