import { site } from '../config/site.ts';

export interface PersonJsonLd {
  '@context': 'https://schema.org';
  '@type': 'Person';
  '@id': string;
  name: string;
  url: string;
  sameAs: readonly string[];
}

/**
 * The `Person` JSON-LD for the about pages, `sameAs` GitHub and LinkedIn (SPEC.md §8).
 * `/` and `/en/` describe the same person, so both must be called with the same `url`
 * (the IT page's), giving them one shared, stable `@id` rather than one per language.
 */
export function personJsonLd(url: string): PersonJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${url}#person`,
    name: site.author,
    url,
    sameAs: [site.social.github, site.social.linkedin],
  };
}
