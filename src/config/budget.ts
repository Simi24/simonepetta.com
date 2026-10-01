/**
 * The performance budget (SPEC.md §12.2), checked in gzip bytes on `dist`.
 * Raising a cap is a visible change to this file.
 */

export const HTML_CAP_BYTES = 50 * 1024;
export const NOTES_CHAPTER_HTML_CAP_BYTES = 150 * 1024;
export const CSS_CAP_BYTES = 20 * 1024;
export const JS_CAP_BYTES = 1024;

/** The only font faces any page may declare, by woff2 file: family, style and subset are pinned together (SPEC.md §12.2). */
export const ALLOWED_FONT_FACES = [
  { family: 'Host Grotesk', style: 'normal', file: '/fonts/host-grotesk-latin.woff2' },
  { family: 'Host Grotesk', style: 'italic', file: '/fonts/host-grotesk-latin-italic.woff2' },
  { family: 'Fira Math', style: 'normal', file: '/fonts/fira-math.woff2' },
] as const;

/**
 * The one external script any page may load: the Cloudflare Web Analytics beacon (SPEC.md
 * §12.4), gated behind a configured token and `SITE_INDEXABLE`. Its weight is an accepted
 * cost, not measured against `JS_CAP_BYTES` — but it, and only it, gets that exemption: any
 * other external script is a budget violation (`scripts/quality/check-budget.ts`) and, on the
 * external-origin build gate (`tests/fonts.test.ts`), a failure.
 */
export const CLOUDFLARE_BEACON_SCRIPT_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';

/** `<script type>` values that never run as JS, so they don't count toward `JS_CAP_BYTES` (SPEC.md §12.3). */
export const NON_JS_SCRIPT_TYPES = ['application/ld+json', 'speculationrules'] as const;

/** A notes chapter page (`/appunti/<slug>/<chapter>/`), never the course page or its chat page. */
export const isNotesChapterPage = (pagePath: string): boolean =>
  /^appunti\/[^/]+\/(?!chat\/)[^/]+\/index\.html$/.test(pagePath);

/**
 * The search page, and the only page that may load Pagefind (SPEC.md §3, §12.2). Its exception
 * is per asset, not per page: only scripts directly under `/pagefind/` are exempt from
 * `JS_CAP_BYTES`, so any other JS on `/cerca/` (like its inline init) is still measured.
 */
export const SEARCH_PAGE = 'cerca/index.html';

/** A file directly under `/pagefind/`: no subpath, `..` segment, query string or fragment. */
const PAGEFIND_FILE = /^\/pagefind\/[A-Za-z0-9_-][A-Za-z0-9_.-]*$/;

export const isPagefindAsset = (pagePath: string, src: string): boolean =>
  pagePath === SEARCH_PAGE && PAGEFIND_FILE.test(src);

/** A notes course's chat page, the only page that may load the Preact island (SPEC.md §3, §12.2). */
const CHAT_PAGE = /^appunti\/[^/]+\/chat\/index\.html$/;

/** A file directly under `/_astro/`: the island's Astro-bundled script, no subpath, `..`, query or fragment. */
const ASTRO_BUNDLE_FILE = /^\/_astro\/[A-Za-z0-9_-][A-Za-z0-9_.-]*\.js$/;

/**
 * The Preact chat island (v2): like Pagefind, an exception per asset, not per page. Only the
 * bundled scripts under `/_astro/` on a chat page are exempt from `JS_CAP_BYTES`; inline JS or
 * any other script on that page is still measured.
 */
export const isPreactIslandAsset = (pagePath: string, src: string): boolean =>
  CHAT_PAGE.test(pagePath) && ASTRO_BUNDLE_FILE.test(src);

/** Pages allowed to load Fira Math: notes chapters that render MathML (SPEC.md §5.2, §12.2). */
export const isMathPage = (pagePath: string, html: string): boolean =>
  isNotesChapterPage(pagePath) && /<math[\s>]/.test(html);
