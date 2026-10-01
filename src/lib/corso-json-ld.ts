import { site } from '../config/site.ts';
import type { Corso } from '../schemas/corso.ts';
import { degreeProgramme } from './corso-presentation.ts';

export interface LearningResourceJsonLd {
  '@context': 'https://schema.org';
  '@type': 'LearningResource';
  '@id': string;
  name: string;
  url: string;
  inLanguage: 'it';
  educationalLevel: string;
  about: string;
}

/** `LearningResource` JSON-LD for a course page, or for one of its chapters via `name` (SPEC.md §7.3, §12.3). */
export function corsoJsonLd(corso: Corso, url: string, name: string = corso.titolo): LearningResourceJsonLd {
  const programme = degreeProgramme(corso.livello);
  return {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    '@id': `${url}#corso`,
    name,
    url,
    inLanguage: 'it',
    educationalLevel: programme,
    about: `${programme}, ${site.appunti.university}`,
  };
}
