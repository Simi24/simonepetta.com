import type { StatoLettura } from '../schemas/lettura.ts';

interface StatoPresentation {
  /** Heading over this state's group in the list (SPEC.md §6.2). */
  groupLabel: string;
  /** Extra class on the spine: the bookmark for in-corso, the lean for abbandonato. */
  spineClass: string;
  /** Which date this state is tracked by, and how the list phrases it. */
  dateField: 'iniziato' | 'finito';
  dateVerb: string;
}

/**
 * The one place per-`stato` presentation is decided, so the shelf, the list and the ordering
 * all read it instead of each running their own switch over `StatoLettura`.
 */
export const STATO_PRESENTATION: Record<StatoLettura, StatoPresentation> = {
  'in-corso': {
    groupLabel: 'Sto leggendo',
    spineClass: 'spine--in-corso',
    dateField: 'iniziato',
    dateVerb: 'iniziato il',
  },
  letto: {
    groupLabel: 'Letti',
    spineClass: '',
    dateField: 'finito',
    dateVerb: 'finito il',
  },
  abbandonato: {
    groupLabel: 'Abbandonati',
    spineClass: 'spine--abbandonato',
    dateField: 'finito',
    dateVerb: 'finito il',
  },
};
