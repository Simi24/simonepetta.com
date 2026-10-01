import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assignChapterSlugs, type RecordedChapter } from './chapter-slugs.ts';
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
  /** Figures shown as "pending" until the figures ticket (#37) converts them. */
  figureInAttesa: number;
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
}

const CHAPTER_FILE = /^Ch(\d+)\.html$/;

function readPreviousSlugs(courseDir: string): RecordedChapter[] {
  const path = join(courseDir, 'build', 'meta.json');
  if (!existsSync(path)) return [];
  const meta = JSON.parse(readFileSync(path, 'utf8')) as Partial<BuildMeta>;
  return (meta.capitoli ?? []).map(({ numero, titolo, slug }) => ({ numero, titolo, slug }));
}

/** Replaces `<courseDir>/build` with `files` in one rename, so a failure never leaves a half-written build. */
function swapBuild(courseDir: string, files: ReadonlyMap<string, string>): void {
  const next = join(courseDir, 'build.next');
  const current = join(courseDir, 'build');
  const old = join(courseDir, 'build.old');
  rmSync(next, { recursive: true, force: true });
  rmSync(old, { recursive: true, force: true });
  mkdirSync(next, { recursive: true });
  for (const [name, content] of files) writeFileSync(join(next, name), content);
  if (existsSync(current)) renameSync(current, old);
  renameSync(next, current);
  rmSync(old, { recursive: true, force: true });
}

/**
 * The Docker-free half of a conversion: LaTeXML's chapter pages in, committed `build/` out.
 * Everything is computed and checked in memory first; `build/` is only replaced when the leak
 * detector (SPEC.md §7.5) finds nothing, so a course keeps its last good build.
 */
export function buildFromLatexml(input: BuildInput): BuildMeta {
  const files = readdirSync(input.htmlDir);
  const chapterFiles = files
    .filter((file) => CHAPTER_FILE.test(file))
    .sort((a, b) => Number(CHAPTER_FILE.exec(a)![1]) - Number(CHAPTER_FILE.exec(b)![1]));
  const extraOutputFiles = files.filter((file) => file.endsWith('.html') && file !== 'index.html' && !CHAPTER_FILE.test(file));

  const pages = chapterFiles.map((file) => ({ file, html: readFileSync(join(input.htmlDir, file), 'utf8') }));
  const heads = pages.map((page) => readChapterHead(page.html));
  const slugs = assignChapterSlugs(heads, readPreviousSlugs(input.courseDir));
  const chapterSlugs = Object.fromEntries(pages.map((page, i) => [page.file, slugs[i]!]));

  const chapters: ProcessedChapter[] = pages.map((page) => processChapter(page.html, { corso: input.corso, chapterSlugs }));

  const leaks = detectLeaks({ source: input.source, chapters, latexmlErrors: input.latexmlErrors, extraOutputFiles });
  if (leaks.length > 0) throw new LeakError(leaks);

  const meta: BuildMeta = {
    capitoli: chapters.map((chapter, i) => ({
      numero: chapter.numero,
      slug: slugs[i]!,
      titolo: chapter.titolo,
      sezioni: chapter.sezioni,
      math: chapter.hasMath,
    })),
    figureInAttesa: chapters.reduce((sum, chapter) => sum + chapter.figurePending, 0),
  };

  const out = new Map<string, string>(chapters.map((chapter, i) => [`${slugs[i]}.html`, `${chapter.html}\n`]));
  out.set('meta.json', `${JSON.stringify(meta, null, 2)}\n`);
  swapBuild(input.courseDir, out);
  return meta;
}
