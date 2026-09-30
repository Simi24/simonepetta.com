import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Writes `appunti/<slug>/meta.json` (page count, from the PDF) for one or every course,
 * outside the site build (SPEC.md §7.2): `node pipeline/appunti-meta.ts <slug>` for one
 * course, or with no argument, every course directory under `--content-dir` (default
 * `./appunti`) that has a `<slug>.pdf`. Requires `pdfinfo` (poppler) on `PATH`.
 */

export interface CorsoMeta {
  pagine: number;
}

/** Parses `pdfinfo`'s "Pages:" line. Throws if the output has none, rather than writing a wrong count. */
export function parsePdfinfoPages(output: string): number {
  const match = /^Pages:\s+(\d+)\s*$/m.exec(output);
  if (!match) throw new Error(`pdfinfo output has no "Pages:" line:\n${output}`);
  return Number(match[1]);
}

/** The PDF's page count, via `pdfinfo` (poppler). */
export function pageCount(pdfPath: string): number {
  const output = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
  return parsePdfinfoPages(output);
}

/** Computes and writes one course's `meta.json` from its `<slug>.pdf`, and returns it. */
export function writeCorsoMeta(contentDir: string, slug: string): CorsoMeta {
  const pdfPath = join(contentDir, slug, `${slug}.pdf`);
  const meta: CorsoMeta = { pagine: pageCount(pdfPath) };
  writeFileSync(join(contentDir, slug, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
  return meta;
}

/** Every course slug under `contentDir` that has a `<slug>.pdf` to count. */
export function coursesWithPdf(contentDir: string): string[] {
  return readdirSync(contentDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((slug) => existsSync(join(contentDir, slug, `${slug}.pdf`)));
}

function main(): void {
  const args = process.argv.slice(2);
  const contentDirIndex = args.indexOf('--content-dir');
  const contentDir = contentDirIndex >= 0 ? args[contentDirIndex + 1]! : './appunti';
  const slugArg = args.find((arg, i) => !arg.startsWith('--') && args[i - 1] !== '--content-dir');

  const slugs = slugArg ? [slugArg] : coursesWithPdf(contentDir);
  for (const slug of slugs) {
    const meta = writeCorsoMeta(contentDir, slug);
    console.log(`${slug}: ${meta.pagine} page(s)`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
