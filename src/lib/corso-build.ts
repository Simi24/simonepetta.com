import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'astro/zod';

const voceSchema = z.object({ id: z.string().min(1), numero: z.string().min(1), titolo: z.string().min(1) });
const sezioneSchema = voceSchema.extend({ sottosezioni: z.array(voceSchema) });

const capitoloSchema = z.object({
  /** A numbered chapter. An appendix has `etichetta` instead; the acknowledgements and bibliography neither. */
  numero: z.number().int().positive().optional(),
  etichetta: z.string().min(1).optional(),
  bibliografia: z.literal(true).optional(),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  titolo: z.string().min(1),
  sezioni: z.array(sezioneSchema),
  math: z.boolean(),
});

const buildSchema = z.object({ capitoli: z.array(capitoloSchema) });

export type Capitolo = z.infer<typeof capitoloSchema>;
export type CorsoBuild = z.infer<typeof buildSchema>;

/** What a page is called before its title in lists and navigation: "3", "Appendice A", nothing for the acknowledgements. */
export const capitoloNumero = (capitolo: Capitolo): string | undefined => capitolo.etichetta ?? capitolo.numero?.toString();

/** "Capitolo 3", "Appendice A", nothing for the acknowledgements. */
export const capitoloEtichetta = (capitolo: Capitolo): string | undefined =>
  capitolo.etichetta ?? (capitolo.numero === undefined ? undefined : `Capitolo ${capitolo.numero}`);

/**
 * Reads `<contentDir>/<slug>/build/meta.json` (SPEC.md §7.3), the pipeline's record of a
 * converted course's chapters. The site build never converts anything (SPEC.md §7.4): it only
 * wraps these committed fragments. Returns `undefined` when the course has no `build/`.
 */
export function readCorsoBuild(contentDir: string, slug: string): CorsoBuild | undefined {
  let raw: string;
  try {
    raw = readFileSync(join(contentDir, slug, 'build', 'meta.json'), 'utf8');
  } catch {
    return undefined;
  }
  return buildSchema.parse(JSON.parse(raw));
}

/** The body-only HTML fragment of one chapter, as post-processed by the pipeline. */
export function readChapterFragment(contentDir: string, slug: string, capitolo: Capitolo): string {
  return readFileSync(join(contentDir, slug, 'build', `${capitolo.slug}.html`), 'utf8');
}
