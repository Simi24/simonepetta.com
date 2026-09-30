/**
 * The performance budget (SPEC.md §12.2), checked in gzip bytes on `dist`.
 * Raising a cap is a visible change to this file.
 */

export const HTML_CAP_BYTES = 50 * 1024;
export const NOTES_CHAPTER_HTML_CAP_BYTES = 150 * 1024;
export const CSS_CAP_BYTES = 20 * 1024;
export const JS_CAP_BYTES = 1024;

export const ALLOWED_FONT_FAMILIES = ['Host Grotesk', 'Fira Math'] as const;

/** `<script type>` values that never run as JS, so they don't count toward `JS_CAP_BYTES` (SPEC.md §12.3). */
export const NON_JS_SCRIPT_TYPES = ['application/ld+json', 'speculationrules'] as const;

/** A notes chapter page (`/appunti/<slug>/<chapter>/`), never the course page or its chat page. */
export const isNotesChapterPage = (pagePath: string): boolean =>
  /^appunti\/[^/]+\/(?!chat\/)[^/]+\/index\.html$/.test(pagePath);

/** Pages exempt from `JS_CAP_BYTES` by a declared exception (SPEC.md §3, §12.2). */
export const JS_CAP_EXCEPTIONS: readonly { pattern: RegExp; reason: string }[] = [
  { pattern: /^cerca\/index\.html$/, reason: 'Pagefind UI and search index (v1)' },
  { pattern: /^appunti\/[^/]+\/chat\/index\.html$/, reason: 'the Preact chat island (v2)' },
];

export const isJsExceptionPage = (pagePath: string): boolean =>
  JS_CAP_EXCEPTIONS.some(({ pattern }) => pattern.test(pagePath));

/** Pages allowed to load Fira Math, because they render MathML. None published yet. */
export const MATH_PAGE_PATTERNS: readonly RegExp[] = [];

export const isMathPage = (pagePath: string): boolean => MATH_PAGE_PATTERNS.some((pattern) => pattern.test(pagePath));
