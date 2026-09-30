import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import {
  ALLOWED_FONT_FAMILIES,
  CSS_CAP_BYTES,
  HTML_CAP_BYTES,
  JS_CAP_BYTES,
  NON_JS_SCRIPT_TYPES,
  NOTES_CHAPTER_HTML_CAP_BYTES,
  isJsExceptionPage,
  isMathPage,
  isNotesChapterPage,
} from '../../src/config/budget.ts';
import { buildSite, filesWithExtension, read } from '../../tests/support/built-site.ts';
import { QUALITY_BUILDS } from '../../tests/support/quality-builds.ts';

export interface Violation {
  page: string;
  message: string;
}

interface PageAssets {
  html: string;
  css: string;
  js: string;
}

const isExternal = (url: string): boolean => /^(https?:)?\/\//.test(url);

/** One HTML tag's attributes, read independently of their order in the source. */
const attr = (tag: string, name: string): string | undefined =>
  new RegExp(`\\b${name}=["']([^"']*)["']`).exec(tag)?.[1];

/** Every `<link>` tag whose (possibly multi-valued) `rel` includes `stylesheet`. */
function stylesheetHrefs(html: string): string[] {
  const hrefs: string[] = [];
  for (const match of html.matchAll(/<link\b[^>]*>/g)) {
    const tag = match[0];
    const rel = attr(tag, 'rel')?.split(/\s+/) ?? [];
    if (!rel.includes('stylesheet')) continue;
    const href = attr(tag, 'href');
    if (href) hrefs.push(href);
  }
  return hrefs;
}

/** Every `<script>` tag's body, paired with its `src` (if linked) and `type` (if declared). */
function scriptTags(html: string): { body: string; src: string | undefined; type: string | undefined }[] {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].map((match) => ({
    body: match[2] ?? '',
    src: attr(match[0], 'src'),
    type: attr(match[0], 'type'),
  }));
}

/** Inline and locally-linked CSS/JS for one built page, the way a browser would load it. */
function collectPageAssets(dist: string, page: string): PageAssets {
  const html = read(dist, page);

  let css = '';
  for (const match of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) css += match[1] ?? '';
  for (const href of stylesheetHrefs(html)) {
    if (isExternal(href)) continue;
    css += read(dist, href.replace(/^\//, ''));
  }

  let js = '';
  for (const { body, src, type } of scriptTags(html)) {
    if (type && (NON_JS_SCRIPT_TYPES as readonly string[]).includes(type)) continue;
    if (src) {
      if (isExternal(src)) continue;
      js += read(dist, src.replace(/^\//, ''));
    } else {
      js += body;
    }
  }

  return { html, css, js };
}

const fontFamiliesIn = (css: string): string[] =>
  [...css.matchAll(/@font-face\s*{[^}]*font-family:\s*["']?([^"';]+?)["']?\s*;[^}]*}/g)].map((m) => m[1]!.trim());

/** Every quality-budget violation on the built site at `dist` (SPEC.md §12.2). */
export function checkBudget(dist: string): Violation[] {
  const violations: Violation[] = [];
  const pages = filesWithExtension(dist, '.html');
  if (pages.length === 0) {
    violations.push({ page: dist, message: 'no HTML pages found: the site did not build, or built empty' });
    return violations;
  }
  for (const page of pages) {
    const { html, css, js } = collectPageAssets(dist, page);

    const htmlBytes = gzipSync(html).length;
    const htmlCap = isNotesChapterPage(page) ? NOTES_CHAPTER_HTML_CAP_BYTES : HTML_CAP_BYTES;
    if (htmlBytes > htmlCap) violations.push({ page, message: `HTML is ${htmlBytes} B gzip, over the ${htmlCap} B cap` });

    const cssBytes = gzipSync(css).length;
    if (cssBytes > CSS_CAP_BYTES) {
      violations.push({ page, message: `CSS is ${cssBytes} B gzip, over the ${CSS_CAP_BYTES} B cap` });
    }

    if (!isJsExceptionPage(page)) {
      const jsBytes = gzipSync(js).length;
      if (jsBytes > JS_CAP_BYTES) {
        violations.push({ page, message: `JS is ${jsBytes} B gzip, over the ${JS_CAP_BYTES} B cap` });
      }
    }

    for (const family of fontFamiliesIn(css)) {
      if (!(ALLOWED_FONT_FAMILIES as readonly string[]).includes(family)) {
        violations.push({ page, message: `loads an undeclared font family "${family}"` });
      } else if (family === 'Fira Math' && !isMathPage(page)) {
        violations.push({ page, message: 'loads Fira Math but is not a declared math page' });
      }
    }
  }
  return violations;
}

/**
 * Whether the CLI must (re)build `dist` before checking it. Standalone, it always builds
 * fresh: a stale `dist` from an earlier source tree must never pass silently. Only with
 * `QUALITY_GATE_REUSE_DIST=1` — set by the `site` workflow and the verify commands, right
 * after their own `npm run build` — is an existing `dist` trusted as-is.
 */
export const shouldBuildFreshDist = ({
  reuseDist,
  distExists,
}: {
  reuseDist: boolean;
  distExists: boolean;
}): boolean => !reuseDist || !distExists;

/** Every violation across several builds, each labeled so a report can tell them apart. */
function checkBudgets(builds: readonly { label: string; dist: string }[]): Violation[] {
  return builds.flatMap(({ label, dist }) => checkBudget(dist).map((v) => ({ ...v, page: `[${label}] ${v.page}` })));
}

function report(builds: readonly { label: string; dist: string }[]): void {
  const violations = checkBudgets(builds);
  if (violations.length > 0) {
    console.error(`Byte budget (SPEC.md §12.2): ${violations.length} violation(s)\n`);
    for (const { page, message } of violations) console.error(`  ${page}: ${message}`);
    process.exitCode = 1;
    return;
  }
  const pageCount = builds.reduce((sum, { dist }) => sum + filesWithExtension(dist, '.html').length, 0);
  console.log(`Byte budget (SPEC.md §12.2): OK (${pageCount} page(s) checked across ${builds.length} build(s))`);
}

/**
 * With an explicit `dist` argument, checks only that directory (building it first unless
 * reused). Without one — the normal `npm run gate:budget` case — it checks the same builds
 * the axe gate does: production (reusing the `dist` a prior `npm run build` staged, when
 * `QUALITY_GATE_REUSE_DIST=1`) plus the fixture-populated builds, so a page type like the
 * post page is budget-checked even before any real content ships.
 */
function main(): void {
  const distArg = process.argv[2];
  const reuseDist = process.env['QUALITY_GATE_REUSE_DIST'] === '1';

  if (distArg) {
    if (shouldBuildFreshDist({ reuseDist, distExists: existsSync(distArg) })) {
      execFileSync('npx', ['astro', 'build', '--outDir', distArg], { stdio: 'inherit' });
    }
    report([{ label: distArg, dist: distArg }]);
    return;
  }

  const productionDist = 'dist';
  if (shouldBuildFreshDist({ reuseDist, distExists: existsSync(productionDist) })) {
    execFileSync('npx', ['astro', 'build', '--outDir', productionDist], { stdio: 'inherit' });
  }

  const builds = [
    { label: 'production', dist: productionDist },
    ...QUALITY_BUILDS.filter((build) => build.label !== 'production').map((build) => ({
      label: build.label,
      dist: buildSite(build.env),
    })),
  ];
  report(builds);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
