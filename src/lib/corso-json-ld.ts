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

/** `LearningResource` JSON-LD for a course page (SPEC.md §7.3, §12.3). */
export function corsoJsonLd(corso: Corso, url: string): LearningResourceJsonLd {
  const programme = degreeProgramme(corso.livello);
  return {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    '@id': `${url}#corso`,
    name: corso.titolo,
    url,
    inLanguage: 'it',
    educationalLevel: programme,
    about: `${programme}, ${site.appunti.university}`,
  };
}
