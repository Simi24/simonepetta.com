import { site } from '../config/site.ts';

export interface PersonJsonLd {
  '@context': 'https://schema.org';
  '@type': 'Person';
  name: string;
  url: string;
  sameAs: readonly string[];
}

/** The `Person` JSON-LD for the about page, `sameAs` GitHub and LinkedIn (SPEC.md §8). */
export function personJsonLd(url: string): PersonJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: site.author,
    url,
    sameAs: [site.social.github, site.social.linkedin],
  };
}
