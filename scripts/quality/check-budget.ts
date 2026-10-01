import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import {
  ALLOWED_FONT_FACES,
  CLOUDFLARE_BEACON_SCRIPT_SRC,
  CSS_CAP_BYTES,
  HTML_CAP_BYTES,
  JS_CAP_BYTES,
  NON_JS_SCRIPT_TYPES,
  NOTES_CHAPTER_HTML_CAP_BYTES,
  isPagefindAsset,
  isPreactIslandAsset,
  isMathPage,
  isNotesChapterPage,
} from '../../src/config/budget.ts';
import { filesWithExtension, read } from '../../tests/support/built-site.ts';
import { qualityDists, shouldBuildFreshDist } from './quality-dists.ts';

export interface Violation {
  page: string;
  message: string;
}

interface PageAssets {
  html: string;
  css: string;
  js: string;
  /** External scripts, stylesheets and other loaded resources, other than the allowlisted beacon. */
  undeclaredExternals: { kind: 'script' | 'stylesheet' | 'resource'; url: string }[];
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

/** `<link rel>` values the browser never fetches: crawler metadata (SPEC.md §8, §12.3). */
const NON_LOADING_LINK_RELS = ['canonical', 'alternate'];

/**
 * External URLs of everything a page loads besides scripts and stylesheets (reported elsewhere):
 * media and frames (`src`, `poster`, `data`, `srcset`) and any other `<link>` that is fetched.
 * Anchors and non-loading links (canonical, hreflang alternates) are not resources.
 */
function externalMediaUrls(html: string): string[] {
  const urls: string[] = [];
  for (const match of html.matchAll(/<(img|iframe|source|video|audio|embed|track|input|object|link)\b[^>]*>/g)) {
    const [tag, name] = [match[0], match[1]];
    if (name === 'link') {
      const rel = attr(tag, 'rel')?.split(/\s+/).filter(Boolean) ?? [];
      const loads = rel.length === 0 || !rel.every((value) => NON_LOADING_LINK_RELS.includes(value));
      const href = attr(tag, 'href');
      if (loads && !rel.includes('stylesheet') && href && isExternal(href)) urls.push(href);
      continue;
    }
    for (const value of [attr(tag, 'src'), attr(tag, 'poster'), attr(tag, 'data')]) {
      if (value && isExternal(value)) urls.push(value);
    }
    for (const candidate of attr(tag, 'srcset')?.split(',') ?? []) {
      const url = candidate.trim().split(/\s+/)[0];
      if (url && isExternal(url)) urls.push(url);
    }
  }
  return urls;
}

/** External URLs in CSS: every `url(...)` and every `@import`, whether a font, an image or a stylesheet. */
function externalCssUrls(css: string): string[] {
  const urls = [...css.matchAll(/url\(\s*["']?([^"')]+?)["']?\s*\)/g)].map((m) => m[1] ?? '');
  urls.push(...[...css.matchAll(/@import\s+["']([^"']+)["']/g)].map((m) => m[1] ?? ''));
  return urls.filter(isExternal);
}

/** Inline and locally-linked CSS/JS for one built page, the way a browser would load it. */
function collectPageAssets(dist: string, page: string): PageAssets {
  const html = read(dist, page);

  let css = '';
  for (const match of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) css += match[1] ?? '';
  const undeclaredExternals: PageAssets['undeclaredExternals'] = [];
  for (const href of stylesheetHrefs(html)) {
    if (isExternal(href)) {
      undeclaredExternals.push({ kind: 'stylesheet', url: href });
      continue;
    }
    css += read(dist, href.replace(/^\//, ''));
  }

  let js = '';
  for (const { body, src, type } of scriptTags(html)) {
    if (type && (NON_JS_SCRIPT_TYPES as readonly string[]).includes(type)) continue;
    if (src) {
      // The Web Analytics beacon is an accepted cost, not measured (SPEC.md §12.4): any OTHER
      // external script is undeclared and fails the budget, rather than silently passing free.
      if (src === CLOUDFLARE_BEACON_SCRIPT_SRC) continue;
      if (isExternal(src)) {
        undeclaredExternals.push({ kind: 'script', url: src });
        continue;
      }
      // Pagefind on /cerca/ and the Preact island on chat pages are the declared exceptions,
      // asset by asset (SPEC.md §12.2).
      if (isPagefindAsset(page, src) || isPreactIslandAsset(page, src)) continue;
      js += read(dist, src.replace(/^\//, ''));
    } else {
      js += body;
    }
  }

  for (const url of [...externalMediaUrls(html), ...externalCssUrls(css)]) {
    undeclaredExternals.push({ kind: 'resource', url });
  }

  return { html, css, js, undeclaredExternals };
}

interface FontFace {
  family: string;
  style: string;
  /** Every `url()` source, in order: the browser may use any of them. */
  srcs: string[];
}

/** Every `@font-face` in `css`: its family, style (default `normal`) and `url()` sources. */
function fontFacesIn(css: string): FontFace[] {
  return [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map((match) => {
    const body = match[1] ?? '';
    return {
      family: /font-family:\s*["']?([^"';]+?)["']?\s*;/.exec(body + ';')?.[1]?.trim() ?? '',
      style: /font-style:\s*([a-z]+)/.exec(body)?.[1] ?? 'normal',
      srcs: [...body.matchAll(/url\(\s*["']?([^"')]+?)["']?\s*\)/g)].map((m) => m[1] ?? ''),
    };
  });
}

/** The woff2 signature every real font file starts with. */
const WOFF2_MAGIC = 'wOF2';

const isWoff2File = (path: string): boolean => readFileSync(path).subarray(0, 4).toString('latin1') === WOFF2_MAGIC;

/**
 * Violations for one declared face: every source must be one of the exact family + style + woff2
 * file combinations, present in `dist` and really woff2. External sources are reported by the
 * external-resource check, not here.
 */
function fontFaceViolations(dist: string, page: string, html: string, face: FontFace): Violation[] {
  const { family, style, srcs } = face;
  if (!ALLOWED_FONT_FACES.some((allowed) => allowed.family === family)) {
    return [{ page, message: `loads an undeclared font family "${family}"` }];
  }
  if (srcs.length === 0) return [{ page, message: `font face "${family}" (${style}) has no woff2 source` }];
  const violations: Violation[] = [];
  for (const src of srcs.filter((url) => !isExternal(url))) {
    if (!ALLOWED_FONT_FACES.some((a) => a.family === family && a.style === style && a.file === src)) {
      violations.push({ page, message: `font face "${family}" (${style}) loads an undeclared file: ${src}` });
    } else if (!existsSync(join(dist, src))) {
      violations.push({ page, message: `font file ${src} is missing from the build` });
    } else if (!isWoff2File(join(dist, src))) {
      violations.push({ page, message: `font file ${src} is empty or not a woff2 file (no wOF2 signature)` });
    }
  }
  if (family === 'Fira Math' && !isMathPage(page, html)) {
    violations.push({ page, message: 'loads Fira Math but is not a declared math page' });
  }
  return violations;
}

/** Every quality-budget violation on the built site at `dist` (SPEC.md §12.2). */
export function checkBudget(dist: string): Violation[] {
  const violations: Violation[] = [];
  const pages = filesWithExtension(dist, '.html');
  if (pages.length === 0) {
    violations.push({ page: dist, message: 'no HTML pages found: the site did not build, or built empty' });
    return violations;
  }
  for (const page of pages) {
    const { html, css, js, undeclaredExternals } = collectPageAssets(dist, page);

    for (const { kind, url } of undeclaredExternals) {
      violations.push({ page, message: `loads an undeclared external ${kind}: ${url}` });
    }

    const htmlBytes = gzipSync(html).length;
    const htmlCap = isNotesChapterPage(page) ? NOTES_CHAPTER_HTML_CAP_BYTES : HTML_CAP_BYTES;
    if (htmlBytes > htmlCap) violations.push({ page, message: `HTML is ${htmlBytes} B gzip, over the ${htmlCap} B cap` });

    const cssBytes = gzipSync(css).length;
    if (cssBytes > CSS_CAP_BYTES) {
      violations.push({ page, message: `CSS is ${cssBytes} B gzip, over the ${CSS_CAP_BYTES} B cap` });
    }

    const jsBytes = gzipSync(js).length;
    if (jsBytes > JS_CAP_BYTES) {
      violations.push({ page, message: `JS is ${jsBytes} B gzip, over the ${JS_CAP_BYTES} B cap` });
    }

    for (const face of fontFacesIn(css)) violations.push(...fontFaceViolations(dist, page, html, face));
  }
  return violations;
}

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
 * the axe gate does (`qualityDists`).
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

  report(qualityDists(reuseDist));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
