import type { CollectionEntry } from 'astro:content';
import { STATO_PRESENTATION } from './lettura-presentation.ts';
import { STATI_LETTURA, type StatoLettura } from '../schemas/lettura.ts';

export type GroupedLetture = Record<StatoLettura, CollectionEntry<'letture'>[]>;

function byDateDesc(field: 'iniziato' | 'finito') {
  return (a: CollectionEntry<'letture'>, b: CollectionEntry<'letture'>): number => {
    const dateA = a.data[field] ?? '';
    const dateB = b.data[field] ?? '';
    return dateB.localeCompare(dateA);
  };
}

/**
 * Groups and orders books per SPEC.md §6.1: in corso by `iniziato` desc, then letti and
 * abbandonati by `finito` desc. Group keys are the `stato` values themselves.
 */
export function orderLetture(entries: readonly CollectionEntry<'letture'>[]): GroupedLetture {
  const grouped: GroupedLetture = { 'in-corso': [], letto: [], abbandonato: [] };
  for (const entry of entries) {
    grouped[entry.data.stato].push(entry);
  }
  for (const stato of STATI_LETTURA) {
    grouped[stato].sort(byDateDesc(STATO_PRESENTATION[stato].dateField));
  }
  return grouped;
}

/** The full shelf order: in corso, then letti, then abbandonati (SPEC.md §6.1). */
export function shelfOrder(grouped: GroupedLetture): CollectionEntry<'letture'>[] {
  return STATI_LETTURA.flatMap((stato) => grouped[stato]);
}
