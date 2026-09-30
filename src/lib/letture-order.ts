import type { Lettura, StatoLettura } from '../schemas/lettura.ts';

export interface LetturaEntry {
  id: string;
  data: Lettura;
}

export interface GroupedLetture {
  corso: LetturaEntry[];
  letti: LetturaEntry[];
  abbandonati: LetturaEntry[];
}

function byDateDesc(field: 'iniziato' | 'finito') {
  return (a: LetturaEntry, b: LetturaEntry): number => {
    const dateA = a.data[field] ?? '';
    const dateB = b.data[field] ?? '';
    return dateB.localeCompare(dateA);
  };
}

/** Groups and orders books per SPEC.md §6.1: in corso by `iniziato` desc, then letti and abbandonati by `finito` desc. */
export function orderLetture(entries: readonly LetturaEntry[]): GroupedLetture {
  const byStato = (stato: StatoLettura) => entries.filter((entry) => entry.data.stato === stato);
  return {
    corso: byStato('in-corso').sort(byDateDesc('iniziato')),
    letti: byStato('letto').sort(byDateDesc('finito')),
    abbandonati: byStato('abbandonato').sort(byDateDesc('finito')),
  };
}

/** The full shelf order: in corso, then letti, then abbandonati (SPEC.md §6.1). */
export function shelfOrder(grouped: GroupedLetture): LetturaEntry[] {
  return [...grouped.corso, ...grouped.letti, ...grouped.abbandonati];
}
