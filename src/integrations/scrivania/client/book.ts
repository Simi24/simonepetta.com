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
  /** The file's `fileVersion` as this page was generated; sent back on a sheet save to catch a stale overwrite. `null` when the file couldn't be read (skips the conflict check). */
  version: string | null;
}

export interface DeskData {
  books: DeskBook[];
}
