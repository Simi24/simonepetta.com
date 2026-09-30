import type { StatoLettura } from '../schemas/lettura.ts';

interface StatoPresentation {
  /** Heading over this state's group in the list (SPEC.md §6.2). */
  groupLabel: string;
  /** Extra class on the spine: the bookmark for in-corso, the lean for abbandonato. */
  spineClass: string;
  /** How the list phrases this state's ordering date (SPEC.md §6.1: `finito` is the drop day, not a finish day, for abbandonato). */
  dateVerb: string;
}

/**
 * The one place per-`stato` presentation is decided, so the shelf and the list read it instead
 * of each running their own switch over `StatoLettura`. Which date each state orders by is a
 * domain rule, not presentation: see `ORDERING_DATE` in `lettura-order.ts`.
 */
export const STATO_PRESENTATION: Record<StatoLettura, StatoPresentation> = {
  'in-corso': {
    groupLabel: 'Sto leggendo',
    spineClass: 'spine--in-corso',
    dateVerb: 'iniziato il',
  },
  letto: {
    groupLabel: 'Letti',
    spineClass: '',
    dateVerb: 'finito il',
  },
  abbandonato: {
    groupLabel: 'Abbandonati',
    spineClass: 'spine--abbandonato',
    dateVerb: 'abbandonato il',
  },
};
