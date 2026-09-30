import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { APPUNTI_CONTENT_DIR } from './config/appunti-content-dir.ts';
import { LETTURA_CONTENT_DIR } from './config/lettura-content-dir.ts';
import { CorsoSchemaError, parseCorso } from './schemas/corso.ts';
import { LetturaSchemaError, parseLettura } from './schemas/lettura.ts';

const letture = defineCollection({
  loader: glob({ pattern: '**/*.md', base: LETTURA_CONTENT_DIR }),
  // Routed through parseLettura, not letturaSchema directly: Astro's own zod error map rewrites
  // plain zod issues (e.g. a missing field becomes English "Required"), which would make the
  // build's own errors disagree with what parseLettura, and later the writing desk, report for
  // the exact same input.
  schema: z.any().transform((data, ctx) => {
    try {
      return parseLettura(data);
    } catch (error) {
      const issues = error instanceof LetturaSchemaError ? error.issues : [String(error)];
      for (const issue of issues) {
        ctx.addIssue({ code: 'custom', message: issue });
      }
      return z.NEVER;
    }
  }),
});

const appunti = defineCollection({
  // One manifest per course directory; the slug is the directory name, not the file name
  // ("corso.yaml" for every course), so it must be generated explicitly.
  loader: glob({
    pattern: '*/corso.yaml',
    base: APPUNTI_CONTENT_DIR,
    generateId: ({ entry }) => entry.split('/')[0]!,
  }),
  // Same reasoning as letture above: routed through parseCorso for one shared, Italian error surface.
  schema: z.any().transform((data, ctx) => {
    try {
      return parseCorso(data);
    } catch (error) {
      const issues = error instanceof CorsoSchemaError ? error.issues : [String(error)];
      for (const issue of issues) {
        ctx.addIssue({ code: 'custom', message: issue });
      }
      return z.NEVER;
    }
  }),
});

export const collections = { letture, appunti };
