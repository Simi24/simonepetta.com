import type { StatoLettura } from '../../../schemas/lettura.ts';

/** A book as the page embeds it for the client script: `undefined` fields become `null` across JSON. */
export interface DeskBook {
  slug: string;
  titolo: string;
  autore: string;
  anno_opera: number | null;
  stato: StatoLettura;
  iniziato: string | null;
  finito: string | null;
  voto: number | null;
  pagine: number | null;
  nota: string | null;
  /** The book's post text, trimmed; `null` when it has none yet (SPEC.md §6.4). */
  testo: string | null;
}

export interface DeskData {
  books: DeskBook[];
}
