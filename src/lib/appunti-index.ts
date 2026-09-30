import type { Livello } from '../schemas/corso.ts';
import type { StatoCorso } from './corso-stato.ts';

/** Page count assumed for a course whose `meta.json` hasn't been produced yet, mid-range of the prototype's 50 to 150. */
export const DEFAULT_PAGINE = 100;

/** A published course as the index needs it (a `tipo: corso` entry, so `anno` is known). */
export interface IndexCourse {
  id: string;
  titolo: string;
  livello: Livello;
  anno: number;
  stato: StatoCorso;
  pagine: number | undefined;
}

export interface Pile {
  livello: Livello;
  anno: number;
  courses: IndexCourse[];
}

const LEVEL_ORDER: Record<Livello, number> = { triennale: 0, magistrale: 1 };

/** Notebook thickness in px, added to a 1.35rem base: one pixel per 8 pages (docs/prototype/visual.html:453). */
export function notebookHeightPx(pagine: number | undefined): number {
  return Math.round((pagine ?? DEFAULT_PAGINE) / 8);
}

/** One pile per year of study (level, then year), courses ordered by title (SPEC.md §5.3). */
export function groupByYear(courses: readonly IndexCourse[]): Pile[] {
  const piles = new Map<string, Pile>();
  for (const course of courses) {
    const key = `${course.livello}:${course.anno}`;
    const pile = piles.get(key) ?? { livello: course.livello, anno: course.anno, courses: [] };
    pile.courses.push(course);
    piles.set(key, pile);
  }
  return [...piles.values()]
    .sort((a, b) => LEVEL_ORDER[a.livello] - LEVEL_ORDER[b.livello] || a.anno - b.anno)
    .map((pile) => ({ ...pile, courses: [...pile.courses].sort((a, b) => a.titolo.localeCompare(b.titolo, 'it')) }));
}

/** A pile's caption: the year, then the level beneath it (docs/prototype/visual.html:469). */
export function pileLabel({ livello, anno }: { livello: Livello; anno: number }): { year: string; level: string } {
  return { year: `${anno}° anno`, level: livello };
}

/** Theses on top: magistrale first, as in the prototype. */
export function sortTheses<T extends { livello: Livello }>(theses: readonly T[]): T[] {
  return [...theses].sort((a, b) => LEVEL_ORDER[b.livello] - LEVEL_ORDER[a.livello]);
}
