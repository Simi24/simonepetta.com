/**
 * Overridable so build-based tests (and the writing desk, SPEC.md §6.4) can point at a fixture
 * collection instead of the real one, without those fixtures ever entering the production build.
 * Kept free of `astro:content` so the writing desk's integration can import it at config-load time.
 */
export const LETTURA_CONTENT_DIR = process.env['LETTURE_CONTENT_DIR'] ?? './src/content/letture';
