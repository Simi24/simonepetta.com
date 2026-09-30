import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'astro/zod';

const corsoMetaSchema = z.object({ pagine: z.number().int().positive() });
export type CorsoMeta = z.infer<typeof corsoMetaSchema>;

/**
 * Reads `<contentDir>/<slug>/meta.json` (SPEC.md §7.2): the site build's only way to know a
 * course's page count. Never reads the PDF itself, and never runs `pdfinfo` — that is the
 * pipeline's job (`pipeline/appunti-meta.ts`), outside the site build. Returns `undefined`
 * when the file doesn't exist yet (a course added before its pipeline step ran).
 */
export function readCorsoMeta(contentDir: string, slug: string): CorsoMeta | undefined {
  let raw: string;
  try {
    raw = readFileSync(join(contentDir, slug, 'meta.json'), 'utf8');
  } catch {
    return undefined;
  }
  return corsoMetaSchema.parse(JSON.parse(raw));
}
