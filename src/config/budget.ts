/**
 * The performance budget (SPEC.md §12.2), checked in gzip bytes on `dist`.
 * Raising a cap is a visible change to this file.
 */

export const HTML_CAP_BYTES = 50 * 1024;
export const NOTES_CHAPTER_HTML_CAP_BYTES = 150 * 1024;
export const CSS_CAP_BYTES = 20 * 1024;
export const JS_CAP_BYTES = 1024;

export const ALLOWED_FONT_FAMILIES = ['Host Grotesk', 'Fira Math'] as const;

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

/** Pages exempt from `JS_CAP_BYTES` as a whole by a declared exception (SPEC.md §3, §12.2). */
export const JS_CAP_EXCEPTIONS: readonly { pattern: RegExp; reason: string }[] = [
  { pattern: /^appunti\/[^/]+\/chat\/index\.html$/, reason: 'the Preact chat island (v2)' },
];

export const isJsExceptionPage = (pagePath: string): boolean =>
  JS_CAP_EXCEPTIONS.some(({ pattern }) => pattern.test(pagePath));

/** Pages allowed to load Fira Math, because they render MathML. None published yet. */
export const MATH_PAGE_PATTERNS: readonly RegExp[] = [];

export const isMathPage = (pagePath: string): boolean => MATH_PAGE_PATTERNS.some((pattern) => pattern.test(pagePath));
