import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { swapIn, type Staged } from './course-swap.ts';
import { assignChapterSlugs, type RecordedChapter } from './chapter-slugs.ts';
import { NO_FIGURES, type FigureAssets } from './figures.ts';
import { detectLeaks } from './leak-detector.ts';
import { processChapter, readChapterHead, type ProcessedChapter, type Sezione } from './latexml-chapter.ts';

/** One chapter as recorded in `build/meta.json`, which the site build reads (`src/lib/corso-build.ts`). */
export interface CapitoloRecord {
  numero: number;
  slug: string;
  titolo: string;
  sezioni: Sezione[];
  /** Whether the chapter has MathML, hence loads Fira Math (SPEC.md §5.2). */
  math: boolean;
}

export interface BuildMeta {
  capitoli: CapitoloRecord[];
}

export class LeakError extends Error {
  readonly leaks: string[];
  constructor(leaks: string[]) {
    super(`The conversion leaks (SPEC.md §7.5), build/ was not updated:\n${leaks.map((leak) => `  - ${leak}`).join('\n')}`);
    this.leaks = leaks;
  }
}

/** The error count off LaTeXML's `Conversion complete: ...` summary line. */
export function parseLatexmlErrors(log: string): number {
  const summary = /^Conversion complete: (.*)$/m.exec(log)?.[1];
  if (summary === undefined) throw new Error('LaTeXML log has no "Conversion complete" summary: the conversion did not finish');
  const errors = /(\d+) errors?\b/.exec(summary)?.[1];
  return errors === undefined ? 0 : Number(errors);
}

export interface BuildInput {
  /** LaTeXML's per-chapter HTML output (`auxdir/html/main`). */
  htmlDir: string;
  /** `appunti/<slug>`, where `build/` is written. */
  courseDir: string;
  corso: string;
  /** Every `.tex` file of the course's `src/`, concatenated. */
  source: string;
  latexmlErrors: number;
  /** What the container made of the figures; none for a course without any. */
  figures?: FigureAssets;
  /** The re-encoded images, by file name (`Raster.name`). */
  figureBytes?: ReadonlyMap<string, Uint8Array>;
}

/** Where the re-encoded images live inside `build/`. */
export const FIGURE_DIR = 'figure';

const CHAPTER_FILE = /^Ch(\d+)\.html$/;

function readPreviousSlugs(courseDir: string): RecordedChapter[] {
  const path = join(courseDir, 'build', 'meta.json');
  if (!existsSync(path)) return [];
  const meta = JSON.parse(readFileSync(path, 'utf8')) as Partial<BuildMeta>;
  return (meta.capitoli ?? []).map(({ numero, titolo, slug }) => ({ numero, titolo, slug }));
}

/** The `build/` folder as a staged entry for `swapIn`. */
export function stagedBuild(files: ReadonlyMap<string, string | Uint8Array>): Staged {
  return {
    name: 'build',
    write: (path) => {
      mkdirSync(path, { recursive: true });
      for (const [name, content] of files) {
        mkdirSync(dirname(join(path, name)), { recursive: true });
        writeFileSync(join(path, name), content);
      }
    },
  };
}

export interface PreparedBuild {
  meta: BuildMeta;
  /** Path inside `build/` to content. */
  files: ReadonlyMap<string, string | Uint8Array>;
}

/**
 * The Docker-free half of a conversion: LaTeXML's chapter pages in, the new `build/` out, in
 * memory. Nothing is written; this throws a `LeakError` when the leak detector (SPEC.md §7.5)
 * finds anything, so a course keeps its last good build.
 */
export function prepareBuild(input: BuildInput): PreparedBuild {
  const outputFiles = readdirSync(input.htmlDir);
  const chapterFiles = outputFiles
    .filter((file) => CHAPTER_FILE.test(file))
    .sort((a, b) => Number(CHAPTER_FILE.exec(a)![1]) - Number(CHAPTER_FILE.exec(b)![1]));
  const extraOutputFiles = outputFiles.filter((file) => file.endsWith('.html') && file !== 'index.html' && !CHAPTER_FILE.test(file));

  const pages = chapterFiles.map((file) => ({ file, html: readFileSync(join(input.htmlDir, file), 'utf8') }));
  const heads = pages.map((page) => readChapterHead(page.html));
  const slugs = assignChapterSlugs(heads, readPreviousSlugs(input.courseDir));
  const chapterSlugs = Object.fromEntries(pages.map((page, i) => [page.file, slugs[i]!]));

  const figures = input.figures ?? NO_FIGURES;
  const figureBytes = input.figureBytes ?? new Map<string, Uint8Array>();
  let tikzTaken = 0;
  const chapters: ProcessedChapter[] = pages.map((page) => {
    const chapter = processChapter(page.html, { corso: input.corso, chapterSlugs }, { ...figures, tikz: figures.tikz.slice(tikzTaken) });
    tikzTaken += chapter.tikzUsed;
    return chapter;
  });

  if (tikzTaken !== figures.tikz.length) {
    throw new Error(`${figures.tikz.length} TikZ picture(s) were compiled but the chapters have ${tikzTaken}: the source and LaTeXML disagree`);
  }

  const leaks = detectLeaks({
    source: input.source,
    chapters,
    latexmlErrors: input.latexmlErrors,
    extraOutputFiles,
    figureFiles: [...figureBytes.keys()],
  });
  const undescribed = [...figures.rasters.keys(), ...figures.tikz.map((tikz) => tikz.key)].filter((key) => (figures.alt[key] ?? '').trim() === '');
  if (undescribed.length > 0) leaks.push(`src/alt.json has no description for: ${undescribed.join(', ')}`);
  if (leaks.length > 0) throw new LeakError(leaks);

  const meta: BuildMeta = {
    capitoli: chapters.map((chapter, i) => ({
      numero: chapter.numero,
      slug: slugs[i]!,
      titolo: chapter.titolo,
      sezioni: chapter.sezioni,
      math: chapter.hasMath,
    })),
  };

  const files = new Map<string, string | Uint8Array>(chapters.map((chapter, i) => [`${slugs[i]}.html`, `${chapter.html}\n`]));
  for (const [name, bytes] of figureBytes) files.set(`${FIGURE_DIR}/${name}`, bytes);
  files.set('meta.json', `${JSON.stringify(meta, null, 2)}\n`);
  return { meta, files };
}

/** `prepareBuild`, then replaces `build/` alone (the PDF and page count are `installConversion`'s). */
export function buildFromLatexml(input: BuildInput): BuildMeta {
  const { meta, files } = prepareBuild(input);
  swapIn(input.courseDir, [stagedBuild(files)]);
  return meta;
}
