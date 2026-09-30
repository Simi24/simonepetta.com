import { join } from 'node:path';
import type { CollectionEntry } from 'astro:content';
import { APPUNTI_CONTENT_DIR } from '../config/appunti-content-dir.ts';
import { LETTURA_CONTENT_DIR } from '../config/lettura-content-dir.ts';
import { isPublished } from './corso-published.ts';
import { hasPost } from './lettura-post.ts';

export interface SitemapPage {
  /** The page's absolute path, trailing slash included (SPEC.md §3). */
  path: string;
  /** The files whose git history gives this page's `lastmod` (SPEC.md §12.3): the template, plus any content directory it renders. */
  files: string[];
}

/**
 * Every real page (SPEC.md §3), excluding the utility endpoints that are not pages themselves
 * (`/404.html`, `/robots.txt`, `/sitemap.xml`). `/` and `/letture/` both render the readings
 * collection (the home's latest three, the index's full shelf), so their `lastmod` follows
 * either their own template or that content changing, whichever is later; `/en/` renders no
 * readings, so its template is the only input. A book's post page is listed only when it has
 * one, and follows its own content file alone, not the shared template. A course page is
 * listed only when published (SPEC.md §7.3: an excluded course gets no page at all), and
 * follows its whole course directory (manifest, PDF, `meta.json`), not just the shared template.
 */
export function sitemapPages(
  letture: readonly CollectionEntry<'letture'>[],
  appunti: readonly CollectionEntry<'appunti'>[] = [],
): SitemapPage[] {
  return [
    { path: '/', files: ['src/pages/index.astro', LETTURA_CONTENT_DIR] },
    { path: '/en/', files: ['src/pages/en/index.astro'] },
    { path: '/letture/', files: ['src/pages/letture/index.astro', LETTURA_CONTENT_DIR] },
    ...letture.filter(hasPost).map((entry) => {
      if (!entry.filePath) {
        throw new Error(`lettura entry "${entry.id}" has no filePath: cannot compute its sitemap lastmod (SPEC.md §12.3)`);
      }
      return { path: `/letture/${entry.id}/`, files: [entry.filePath] };
    }),
    ...appunti.filter(isPublished).map((entry) => ({
      path: `/appunti/${entry.id}/`,
      files: ['src/pages/appunti/[slug]/index.astro', join(APPUNTI_CONTENT_DIR, entry.id)],
    })),
  ];
}
