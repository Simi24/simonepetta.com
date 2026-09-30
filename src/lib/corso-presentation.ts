import { site } from '../config/site.ts';
import type { Corso } from '../schemas/corso.ts';

/** The degree programme name for a course's level (SPEC.md §7.2, §12.3, flagged for the author to confirm). */
export function degreeProgramme(livello: Corso['livello']): string {
  return site.appunti.degreeProgrammes[livello];
}

/** Page `<title>` with course, level and university, for SEO (SPEC.md §7.3, §12.3). No em-dash: a comma-separated list. */
export function corsoTitle(corso: Corso): string {
  return `${corso.titolo}, ${degreeProgramme(corso.livello)}, ${site.appunti.university}`;
}

/** Functional description shared by a course page's OG tags and its JSON-LD (SPEC.md §1.2 point 3, §12.3). */
export function corsoDescription(corso: Corso): string {
  const kind = corso.tipo === 'tesi' ? 'Tesi' : 'Corso';
  return `${kind} di ${degreeProgramme(corso.livello)}, ${site.appunti.university}. Appunti di uno studente, anno accademico ${corso.aa}.`;
}

/** The student-notes notice at the top of a course page (SPEC.md §5.4, §7.3), worded for a course or a thesis. */
export function corsoNotice(corso: Corso): string {
  const target = corso.tipo === 'tesi' ? 'della tesi' : 'del corso';
  return `Appunti di uno studente, non materiale ufficiale ${target}. Possono contenere errori.`;
}
