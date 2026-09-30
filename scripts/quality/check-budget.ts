import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import {
  ALLOWED_FONT_FAMILIES,
  CSS_CAP_BYTES,
  HTML_CAP_BYTES,
  JS_CAP_BYTES,
  NOTES_CHAPTER_HTML_CAP_BYTES,
  isJsExceptionPage,
  isMathPage,
  isNotesChapterPage,
} from '../../src/config/budget.ts';
import { filesWithExtension, read } from '../../tests/support/built-site.ts';

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

/** Inline and locally-linked CSS/JS for one built page, the way a browser would load it. */
function collectPageAssets(dist: string, page: string): PageAssets {
  const html = read(dist, page);
  let css = '';
  for (const match of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) css += match[1] ?? '';
  for (const match of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)) {
    const href = match[1]!;
    if (isExternal(href)) continue;
    css += read(dist, href.replace(/^\//, ''));
  }
  let js = '';
  for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) js += match[1] ?? '';
  for (const match of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
    const src = match[1]!;
    if (isExternal(src)) continue;
    js += read(dist, src.replace(/^\//, ''));
  }
  return { html, css, js };
}

const fontFamiliesIn = (css: string): string[] =>
  [...css.matchAll(/@font-face\s*{[^}]*font-family:\s*["']?([^"';]+?)["']?\s*;[^}]*}/g)].map((m) => m[1]!.trim());

/** Every quality-budget violation on the built site at `dist` (SPEC.md §12.2). */
export function checkBudget(dist: string): Violation[] {
  const violations: Violation[] = [];
  for (const page of filesWithExtension(dist, '.html')) {
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

function main(): void {
  const dist = process.argv[2] ?? 'dist';
  if (!existsSync(dist)) execFileSync('npx', ['astro', 'build', '--outDir', dist], { stdio: 'inherit' });

  const violations = checkBudget(dist);
  if (violations.length > 0) {
    console.error(`Byte budget (SPEC.md §12.2): ${violations.length} violation(s)\n`);
    for (const { page, message } of violations) console.error(`  ${page}: ${message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Byte budget (SPEC.md §12.2): OK (${filesWithExtension(dist, '.html').length} page(s) checked)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
