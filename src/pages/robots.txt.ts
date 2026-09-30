import { SITE_INDEXABLE } from 'astro:env/server';
import type { APIRoute } from 'astro';

/**
 * `/robots.txt`. Crawling is always allowed: while `SITE_INDEXABLE` is off (previews,
 * pre-launch), keeping pages out of the index relies on their `noindex` meta (SPEC.md §11),
 * and a crawler can only see that meta by fetching the page — a `Disallow: /` here would hide
 * it instead. The `Sitemap` line is withheld until then, since advertising a sitemap of pages
 * still marked `noindex` would be a contradiction.
 */
export const GET: APIRoute = ({ site }) => {
  if (!SITE_INDEXABLE) {
    return new Response('User-agent: *\nAllow: /\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  const origin = site ?? new URL('https://simonepetta.com/');
  const sitemapUrl = new URL('/sitemap.xml', origin).toString();
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
