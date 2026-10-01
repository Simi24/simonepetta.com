import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APPUNTI_CONTENT_DIR } from '../src/config/appunti-content-dir.ts';
import { LeakError, parseLatexmlErrors, parseLatexmlPostErrors, prepareBuild } from './appunti-build.ts';
import { readSources } from './course-sources.ts';
import { installConversion } from './appunti-install.ts';
import { recoverInterruptedSwap } from './course-swap.ts';
import { makeFigures } from './figures-docker.ts';

/**
 * Converts one course (SPEC.md §7.4), outside the site build:
 *
 *   npm run appunti:convert -- <slug> [--content-dir <dir>] [--keep-workdir]
 *
 * Runs LaTeXML via BookML and latexmk in Docker (`pipeline/Dockerfile`, built on first use,
 * image `simonepetta-appunti`) on a temporary copy of `appunti/<slug>/src/`, then:
 *   0. re-encodes the images to WebP and compiles the TikZ pictures to SVG, still in Docker
 *      (`figures.sh`), with the descriptions from `src/alt.json`;
 *   1. post-processes the chapters into `build/` fragments (`appunti-build.ts`),
 *      after the leak detector found nothing;
 *   2. counts the pages of the PDF compiled from the same source, then swaps `build/`, `<slug>.pdf`
 *      and `meta.json` in together (`course-swap.ts`).
 * If anything leaks or fails, nothing in the course folder changes.
 */

const IMAGE = 'simonepetta-appunti';
const PIPELINE_DIR = fileURLToPath(new URL('.', import.meta.url));
const MAIN = 'main';

/** BookML's per-chapter run, inside the container. `main.tex` is the course's entry point. */
const CONTAINER_SCRIPT = 'cp -R /opt/bookml-release/bookml . && cp bookml/GNUmakefile . && make SPLITAT=chapter';

/**
 * On Linux, files a root container writes into the bind mount are root-owned and the host cannot
 * remove them. Run as the invoking user instead, with a writable HOME for the TeX and ImageMagick
 * caches. macOS Docker Desktop remaps ownership, so it keeps running as root there.
 */
function asInvokingUser(): string[] {
  if (process.platform !== 'linux' || process.getuid === undefined || process.getgid === undefined) return [];
  return ['--user', `${process.getuid()}:${process.getgid()}`, '-e', 'HOME=/tmp'];
}

function ensureImage(): void {
  const present = spawnSync('docker', ['image', 'inspect', IMAGE], { stdio: 'ignore' }).status === 0;
  if (present) return;
  console.log(`Building the ${IMAGE} image (TeX Live + LaTeXML + BookML), once...`);
  execFileSync('docker', ['build', '-t', IMAGE, PIPELINE_DIR], { stdio: 'inherit' });
}

function convert(contentDir: string, slug: string, keepWorkdir: boolean): void {
  const courseDir = join(contentDir, slug);
  const srcDir = join(courseDir, 'src');
  if (!existsSync(join(srcDir, `${MAIN}.tex`))) {
    throw new Error(`${relative('.', srcDir)}/${MAIN}.tex not found: copy the course's LaTeX sources into src/ first (SPEC.md §7.4)`);
  }

  recoverInterruptedSwap(courseDir);
  ensureImage();
  const work = mkdtempSync(join(tmpdir(), `appunti-${slug}-`));
  try {
    cpSync(srcDir, work, { recursive: true });
    for (const binding of readdirSync(join(PIPELINE_DIR, 'bindings'))) {
      copyFileSync(join(PIPELINE_DIR, 'bindings', binding), join(work, binding));
    }

    console.log(`Converting ${slug} in Docker (LaTeXML + BookML, latexmk)...`);
    const runInContainer = (script: string): void => {
      execFileSync('docker', ['run', '--rm', ...asInvokingUser(), '-v', `${work}:/work`, IMAGE, 'sh', '-c', script], { stdio: 'inherit' });
    };
    runInContainer(CONTAINER_SCRIPT);

    const pdf = join(work, `${MAIN}.pdf`);
    if (!existsSync(pdf)) throw new Error('the PDF was not produced: the course does not compile');
    const latexmlErrors = parseLatexmlErrors(readFileSync(join(work, 'auxdir/latexmlaux', `${MAIN}.latexml.log`), 'utf8'));

    const postErrors = parseLatexmlPostErrors(readFileSync(join(work, 'auxdir/latexmlaux', `${MAIN}.latexmlpost.log`), 'utf8'));
    if (postErrors.length > 0) throw new Error(`latexmlpost reported errors:\n${postErrors.map((error) => `  - ${error}`).join('\n')}`);

    const htmlDir = join(work, 'auxdir/html', MAIN);
    console.log('Re-encoding the images and compiling the TikZ pictures...');
    const chapterPages = readdirSync(htmlDir)
      .filter((file) => /^Ch\d+\.html$/.test(file))
      .map((file) => readFileSync(join(htmlDir, file), 'utf8'));
    const figures = makeFigures({ work, srcDir, chapterPages, runInContainer });

    const prepared = prepareBuild({
      htmlDir,
      courseDir,
      corso: slug,
      source: readSources(srcDir),
      latexmlErrors,
      figures: figures.assets,
      figureBytes: figures.bytes,
    });

    const pagine = installConversion({ courseDir, corso: slug, prepared, pdfPath: pdf });
    const { meta } = prepared;
    console.log(`${slug}: ${meta.capitoli.length} chapter(s), ${figures.bytes.size} image(s), ${figures.assets.tikz.length} TikZ picture(s), PDF ${pagine} page(s)`);
  } finally {
    if (keepWorkdir) console.log(`Work directory kept: ${work}`);
    else rmSync(work, { recursive: true, force: true });
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const contentDirIndex = args.indexOf('--content-dir');
  const contentDir = contentDirIndex >= 0 ? args[contentDirIndex + 1]! : APPUNTI_CONTENT_DIR;
  const slug = args.find((arg, i) => !arg.startsWith('--') && args[i - 1] !== '--content-dir');
  if (!slug) {
    console.error('Usage: npm run appunti:convert -- <slug> [--content-dir <dir>] [--keep-workdir]');
    process.exit(2);
  }
  try {
    convert(contentDir, slug, args.includes('--keep-workdir'));
  } catch (error) {
    console.error(error instanceof LeakError ? error.message : `Conversion failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
