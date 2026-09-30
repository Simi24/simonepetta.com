import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { letturaSchema } from './schemas/lettura.ts';

// Overridable so build-based tests can point at a fixture collection instead
// of the real one, without those fixtures ever entering the production build.
const letturaBase = process.env['LETTURE_CONTENT_DIR'] ?? './src/content/letture';

const letture = defineCollection({
  loader: glob({ pattern: '**/*.md', base: letturaBase }),
  schema: letturaSchema,
});

export const collections = { letture };
