import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import { gitLastmod } from '../lib/git-lastmod.ts';
import { sitemapPages } from '../lib/sitemap-pages.ts';
import { escapeXml } from '../lib/xml-escape.ts';

/** `/sitemap.xml`: every page with a git-derived `lastmod`, no dependency (SPEC.md §12.3). */
export const GET: APIRoute = async ({ site: base }) => {
  const origin = base ?? new URL('https://simonepetta.com/');
  const collection = await getCollection('letture');

  const urlsXml = sitemapPages(collection)
    .map(
      ({ path, file }) => `
  <url>
    <loc>${escapeXml(new URL(path, origin).toString())}</loc>
    <lastmod>${gitLastmod(file)}</lastmod>
  </url>`,
    )
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urlsXml}
</urlset>
`;

  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
