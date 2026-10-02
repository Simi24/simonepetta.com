import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { LetturaSchemaError } from '../../schemas/lettura.ts';

/**
 * The file an existing entry lives in, resolved from the content directory's own listing: the
 * name the client sends is only ever compared against what is actually there, never joined to the
 * directory as a path, so it cannot point anywhere else (no separators, no `..`, no new file).
 * An entry's file name is not always its id: a hand-made `Il Nome.md` has the id `il-nome`.
 */
export function resolveEntryFile(contentDir: string, file: string): string {
  const listed = existsSync(contentDir) ? readdirSync(contentDir).find((name) => name === file && name.endsWith('.md')) : undefined;
  if (listed === undefined) {
    throw new LetturaSchemaError([`il campo "file": nessun libro nel file "${file}"`]);
  }
  return join(contentDir, listed);
}
