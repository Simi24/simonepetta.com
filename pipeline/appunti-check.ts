import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APPUNTI_CONTENT_DIR } from '../src/config/appunti-content-dir.ts';
import type { BuildMeta } from './appunti-build.ts';
import { pageCount as pdfPageCount } from './appunti-meta.ts';
import { readCorsoManifest } from './corso-manifest.ts';
import { readSources } from './course-sources.ts';
import { detectLeaks } from './leak-detector.ts';

/**
 * The checks of the `appunti` workflow (SPEC.md §7.5, §11), all without Docker or LaTeX:
 *
 *   node pipeline/appunti-check.ts [--content-dir <dir>]
 *
 * For every published course: `meta.json` matches the page count of its PDF (`pdfinfo`); and,
 * when the course is converted (has a `build/`), the leak detector compares the committed
 * `build/` with `src/`. Checking nothing is a failure, not a pass.
 *
 * Two things the detector cannot see in a committed build, because the pipeline removes them
 * from the fragments: the number of tcolorbox environments and their titles, and LaTeXML's own
 * error count. Those are only checked when a course is converted (`npm run appunti:convert`
 * and the dispatch re-conversion), where the container's output is at hand.
 */

export interface CheckResult {
  /** The published courses that were checked. */
  checked: string[];
  problems: string[];
}

export interface CheckOptions {
  /** Page count of a PDF; defaults to `pdfinfo`. Injectable so the checks run without poppler. */
  pageCount?: (pdfPath: string) => number;
}

function checkMeta(courseDir: string, slug: string, pageCount: (pdf: string) => number): string[] {
  const pdf = join(courseDir, `${slug}.pdf`);
  const metaPath = join(courseDir, 'meta.json');
  if (!existsSync(pdf)) return [`${slug}: ${slug}.pdf is missing`];
  if (!existsSync(metaPath)) return [`${slug}: meta.json is missing`];
  const recorded = (JSON.parse(readFileSync(metaPath, 'utf8')) as { pagine?: unknown }).pagine;
  const actual = pageCount(pdf);
  return recorded === actual ? [] : [`${slug}: meta.json says ${String(recorded)} page(s), ${slug}.pdf has ${actual}`];
}

function checkBuild(courseDir: string, slug: string): string[] {
  const buildDir = join(courseDir, 'build');
  const srcDir = join(courseDir, 'src');
  if (!existsSync(srcDir)) return [`${slug}: build/ has no src/ to compare with`];
  const { capitoli } = JSON.parse(readFileSync(join(buildDir, 'meta.json'), 'utf8')) as BuildMeta;
  const figureDir = join(buildDir, 'figure');
  const leaks = detectLeaks({
    source: readSources(srcDir),
    chapters: capitoli.map((capitolo) => ({
      numero: capitolo.numero,
      titolo: capitolo.titolo,
      html: readFileSync(join(buildDir, `${capitolo.slug}.html`), 'utf8'),
    })),
    latexmlErrors: 0,
    extraOutputFiles: [],
    figureFiles: existsSync(figureDir) ? readdirSync(figureDir) : [],
  });
  return leaks.map((leak) => `${slug}: ${leak}`);
}

export function checkCourses(contentDir: string, options: CheckOptions = {}): CheckResult {
  const pageCount = options.pageCount ?? pdfPageCount;
  const problems: string[] = [];
  const slugs: string[] = [];
  for (const entry of readdirSync(contentDir, { withFileTypes: true }).filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const manifest = join(contentDir, entry.name, 'corso.yaml');
    if (!existsSync(manifest)) continue;
    try {
      if (readCorsoManifest(readFileSync(manifest, 'utf8')).pubblicato) slugs.push(entry.name);
    } catch (error) {
      // A manifest the site cannot read must not silently drop its course from the check.
      problems.push(`${entry.name}: corso.yaml is invalid: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  for (const slug of slugs) {
    const courseDir = join(contentDir, slug);
    problems.push(...checkMeta(courseDir, slug, pageCount));
    if (existsSync(join(courseDir, 'build'))) problems.push(...checkBuild(courseDir, slug));
  }
  if (slugs.length === 0) problems.push(`no published course under ${contentDir}: nothing was checked`);
  return { checked: slugs, problems };
}

function main(): void {
  const args = process.argv.slice(2);
  const contentDirIndex = args.indexOf('--content-dir');
  const contentDir = contentDirIndex >= 0 ? args[contentDirIndex + 1]! : APPUNTI_CONTENT_DIR;
  const { checked, problems } = checkCourses(contentDir);
  if (problems.length > 0) {
    console.error(`The notes check found ${problems.length} problem(s):\n${problems.map((problem) => `  - ${problem}`).join('\n')}`);
    process.exit(1);
  }
  console.log(`Checked ${checked.length} published course(s): ${checked.join(', ')}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
