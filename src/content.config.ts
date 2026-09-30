import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { LetturaSchemaError, parseLettura } from './schemas/lettura.ts';

// Overridable so build-based tests can point at a fixture collection instead
// of the real one, without those fixtures ever entering the production build.
const letturaBase = process.env['LETTURE_CONTENT_DIR'] ?? './src/content/letture';

const letture = defineCollection({
  loader: glob({ pattern: '**/*.md', base: letturaBase }),
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

export const collections = { letture };
