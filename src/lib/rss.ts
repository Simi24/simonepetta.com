import { escapeXml } from './xml-escape.ts';

export interface RssItem {
  title: string;
  link: string;
  guid: string;
  /** RFC 822, or `undefined` when the item has no date to pin it to: `pubDate` is optional in RSS 2.0, so it is then omitted entirely, never emitted invalid (SPEC.md §6.5). */
  pubDate: string | undefined;
  description: string;
}

export interface RssChannel {
  title: string;
  link: string;
  selfLink: string;
  description: string;
  language: string;
  items: readonly RssItem[];
}

/** Hand-rolled RSS 2.0, no dependency (SPEC.md §6.5, §4.1). */
export function buildRssXml(channel: RssChannel): string {
  const itemsXml = channel.items
    .map(
      (item) => `
    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="true">${escapeXml(item.guid)}</guid>${item.pubDate ? `\n      <pubDate>${item.pubDate}</pubDate>` : ''}
      <description>${escapeXml(item.description)}</description>
    </item>`,
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(channel.title)}</title>
    <link>${escapeXml(channel.link)}</link>
    <description>${escapeXml(channel.description)}</description>
    <language>${channel.language}</language>
    <atom:link href="${escapeXml(channel.selfLink)}" rel="self" type="application/rss+xml" />${itemsXml}
  </channel>
</rss>
`;
}
