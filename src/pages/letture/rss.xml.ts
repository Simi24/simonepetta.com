import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import { site } from '../../config/site.ts';
import { feedDate, feedEntries } from '../../lib/lettura-feed.ts';
import { LETTURE_SECTION_DESCRIPTION, postDescription } from '../../lib/lettura-meta.ts';
import { toRfc822 } from '../../lib/rss-date.ts';
import { buildRssXml } from '../../lib/rss.ts';

/** `/letture/rss.xml`: a static endpoint, no dependency, only books with a text (SPEC.md §6.5). */
export const GET: APIRoute = async ({ site: base }) => {
  const origin = base ?? new URL('https://simonepetta.com/');
  const collection = await getCollection('letture');

  const items = feedEntries(collection).map((entry) => {
    const link = new URL(`/letture/${entry.id}/`, origin).toString();
    const date = feedDate(entry);
    return {
      title: entry.data.titolo,
      link,
      guid: link,
      pubDate: date ? toRfc822(date) : undefined,
      description: postDescription(entry),
    };
  });

  const xml = buildRssXml({
    title: 'Letture',
    link: new URL('/letture/', origin).toString(),
    selfLink: new URL('/letture/rss.xml', origin).toString(),
    description: LETTURE_SECTION_DESCRIPTION,
    language: site.lang,
    items,
  });

  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
