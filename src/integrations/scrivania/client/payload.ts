import type { SavePayload } from '../payload.ts';
import type { DeskBook } from './book.ts';

/** What every save of an existing book carries over unless the form edits it. */
export function carriedData(book: DeskBook): Record<string, unknown> {
  return { titolo: book.titolo, autore: book.autore, anno_opera: book.anno_opera ?? undefined, pagine: book.pagine ?? undefined };
}

/** A metadata-only save of an existing book: its body is never touched. */
export function editPayload(book: DeskBook, data: Record<string, unknown>): SavePayload {
  return { slug: book.slug, file: book.file, data };
}

/** A save from the writing sheet: the draft replaces the body, unless the file changed since the page loaded. */
export function sheetPayload(book: DeskBook, data: Record<string, unknown>, testo: string): SavePayload {
  return { ...editPayload(book, data), testo, expectedVersion: book.version ?? undefined };
}
