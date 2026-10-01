import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'astro/zod';

const voceSchema = z.object({ id: z.string().min(1), numero: z.string().min(1), titolo: z.string().min(1) });
const sezioneSchema = voceSchema.extend({ sottosezioni: z.array(voceSchema) });

const capitoloSchema = z.object({
  numero: z.number().int().positive(),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  titolo: z.string().min(1),
  sezioni: z.array(sezioneSchema),
  math: z.boolean(),
});

const buildSchema = z.object({ capitoli: z.array(capitoloSchema) });

export type Capitolo = z.infer<typeof capitoloSchema>;
export type CorsoBuild = z.infer<typeof buildSchema>;

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
