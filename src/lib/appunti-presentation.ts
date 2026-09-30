import type { StatoCorso } from './corso-stato.ts';

/** How a course is available, for a notebook's tooltip (docs/prototype/visual.html:403). */
export const FORMAT_LABEL: Record<StatoCorso, string> = {
  pdf: 'PDF',
  html: 'Web e PDF',
  scansione: 'PDF scansionato',
};
