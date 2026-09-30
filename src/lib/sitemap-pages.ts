import type { CollectionEntry } from 'astro:content';
import { hasPost } from './lettura-post.ts';

export interface SitemapPage {
  /** The page's absolute path, trailing slash included (SPEC.md §3). */
  path: string;
  /** The file whose git history gives this page's `lastmod` (SPEC.md §12.3). */
  file: string;
}

/**
 * Every real page (SPEC.md §3), excluding the utility endpoints that are not pages themselves
 * (`/404.html`, `/robots.txt`, `/sitemap.xml`). A book's post page is listed only when it has
 * one; its `lastmod` comes from its own content file, not the shared template.
 */
export function sitemapPages(letture: readonly CollectionEntry<'letture'>[]): SitemapPage[] {
  return [
    { path: '/', file: 'src/pages/index.astro' },
    { path: '/en/', file: 'src/pages/en/index.astro' },
    { path: '/letture/', file: 'src/pages/letture/index.astro' },
    ...letture.filter(hasPost).map((entry) => ({ path: `/letture/${entry.id}/`, file: entry.filePath ?? '' })),
  ];
}
