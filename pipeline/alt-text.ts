import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The file, in a course's `src/`, holding the figures' descriptions (SPEC.md §7.4). */
export const ALT_FILE = 'alt.json';

/**
 * The drafted descriptions: one reviewable file, keyed by an image's path as `\includegraphics`
 * names it (`images/a.png`) or by a TikZ picture's `key` (`img/up.tex#1`). Later conversions reuse
 * them; the author reviews them in one place. A missing file is an empty store (a first
 * conversion), a malformed one an error: it must never read as "nothing described".
 */
export function readAlt(srcDir: string): Record<string, string> {
  const path = join(srcDir, ALT_FILE);
  if (!existsSync(path)) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`${ALT_FILE} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error(`${ALT_FILE} must be an object of figure to description`);
  for (const [figure, description] of Object.entries(parsed)) {
    if (typeof description !== 'string' || description.trim() === '') throw new Error(`${ALT_FILE}: the description of "${figure}" must be a non-empty string`);
  }
  return parsed as Record<string, string>;
}
