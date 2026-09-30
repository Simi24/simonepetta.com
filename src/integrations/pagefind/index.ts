import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import * as pagefind from 'pagefind';

/**
 * Builds the Pagefind index over the finished `dist` (SPEC.md §7.3, §12.2). Running it as a
 * hook of `astro build` means every build, whatever its `--outDir` (CI, deploy, preview, the
 * fixture builds of the tests and gates), carries the index without an extra step. Only pages
 * marked `data-pagefind-body` are indexed: readings and notes pages, never `/cerca/` or the 404.
 */
export function pagefindIndex(): AstroIntegration {
  return {
    name: 'pagefind-index',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const site = fileURLToPath(dir);
        const { index, errors: createErrors } = await pagefind.createIndex();
        if (!index) throw new Error(`Pagefind could not create an index: ${createErrors.join('; ')}`);
        try {
          const { page_count, errors } = await index.addDirectory({ path: site });
          if (errors.length > 0) throw new Error(`Pagefind failed to index ${site}: ${errors.join('; ')}`);
          if (page_count === 0) logger.warn('no page is marked data-pagefind-body: the search index is empty');
          const written = await index.writeFiles({ outputPath: `${site}pagefind` });
          if (written.errors.length > 0) throw new Error(`Pagefind failed to write its files: ${written.errors.join('; ')}`);
          logger.info(`indexed ${page_count} page(s) for search`);
        } finally {
          await pagefind.close();
        }
      },
    },
  };
}
