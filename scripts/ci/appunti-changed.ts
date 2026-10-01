import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The `appunti` workflow's early exit (SPEC.md §11): reads the changed file names, one per line,
 * from stdin and prints `notes=true` or `notes=false` (a `GITHUB_OUTPUT` line).
 */

const WATCHED = [/^appunti\//, /^pipeline\//, /^\.github\/workflows\/appunti\.yml$/];

export const notesChanged = (files: readonly string[]): boolean => files.some((file) => WATCHED.some((pattern) => pattern.test(file)));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = readFileSync(0, 'utf8').split('\n').filter(Boolean);
  console.log(`notes=${notesChanged(files)}`);
}
