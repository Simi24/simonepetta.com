import { SITE_INDEXABLE } from 'astro:env/server';
import type { APIRoute } from 'astro';

/**
 * `/robots.txt`. While `SITE_INDEXABLE` is off (previews, pre-launch), every page already
 * carries `noindex` (SPEC.md §11): this disallows crawling outright, and — since pointing
 * crawlers at a sitemap of pages they're told not to index is a contradiction — leaves out
 * the `Sitemap` line too. Once indexable, crawling is allowed and the sitemap is advertised.
 */
export const GET: APIRoute = ({ site }) => {
  if (!SITE_INDEXABLE) {
    return new Response('User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  const origin = site ?? new URL('https://simonepetta.com/');
  const sitemapUrl = new URL('/sitemap.xml', origin).toString();
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
