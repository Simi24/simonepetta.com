import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Every `.tex` under `dir`, concatenated, for the leak detector. */
export function readSources(dir: string): string {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.tex'))
    .sort()
    .map((file) => readFileSync(join(dir, file), 'utf8'))
    .join('\n');
}
