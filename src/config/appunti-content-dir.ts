/**
 * Overridable so build-based tests (and the pipeline script) can point at a fixture content
 * directory instead of the real one. Kept free of `astro:content` so `pipeline/appunti-meta.ts`
 * can use the same default without importing the Astro config.
 */
export const APPUNTI_CONTENT_DIR = process.env['APPUNTI_CONTENT_DIR'] ?? './appunti';
