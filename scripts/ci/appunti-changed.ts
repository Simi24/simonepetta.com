import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * The `appunti` workflow's early exit (SPEC.md §11): `node scripts/ci/appunti-changed.ts <base> <head>`
 * prints `notes=true` or `notes=false` (a `GITHUB_OUTPUT` line) for the diff between two commits.
 */

const WATCHED = [/^appunti\//, /^pipeline\//, /^\.github\/workflows\/appunti\.yml$/];

export const notesChanged = (files: readonly string[]): boolean => files.some((file) => WATCHED.some((pattern) => pattern.test(file)));

/** `--no-renames`: a file moved out of a watched folder is listed under its old path too, so it counts. */
export function notesChangedBetween(base: string, head: string, cwd = '.'): boolean {
  const names = execFileSync('git', ['diff', '--name-only', '--no-renames', base, head], { cwd, encoding: 'utf8' });
  return notesChanged(names.split('\n').filter(Boolean));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [base, head] = process.argv.slice(2);
  console.log(`notes=${notesChangedBetween(base!, head!)}`);
}
