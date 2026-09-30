import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import * as pagefind from 'pagefind';

const MARKER = 'data-pagefind-body';

/** The built pages marked for indexing, as `[path relative to dist, html]`. */
function markedPages(site: string): [string, string][] {
  return readdirSync(site, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.html'))
    .map((file): [string, string] => [file, readFileSync(join(site, file), 'utf8')])
    .filter(([, html]) => html.includes(MARKER));
}

/**
 * Builds the Pagefind index over the finished `dist` (SPEC.md §7.3, §12.2). Running it as a
 * hook of `astro build` means every build, whatever its `--outDir` (CI, deploy, preview, the
 * fixture builds of the tests and gates), carries the index without an extra step.
 *
 * Only pages marked `data-pagefind-body` (readings and notes) are added, one by one: Pagefind
 * itself indexes every page when none is marked, which would put `/cerca/`, the 404 and the
 * rest of the chrome in the results. With no marked page the index is written empty, so
 * `/cerca/` still has its UI files, and the build warns.
 */
export function pagefindIndex(): AstroIntegration {
  return {
    name: 'pagefind-index',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const site = fileURLToPath(dir);
        const pages = markedPages(site);
        if (pages.length === 0) logger.warn(`no page is marked ${MARKER}: the search index is empty`);
        const { index, errors: createErrors } = await pagefind.createIndex();
        if (!index) throw new Error(`Pagefind could not create an index: ${createErrors.join('; ')}`);
        try {
          for (const [sourcePath, content] of pages) {
            const { errors } = await index.addHTMLFile({ sourcePath, content });
            if (errors.length > 0) throw new Error(`Pagefind failed to index ${sourcePath}: ${errors.join('; ')}`);
          }
          const written = await index.writeFiles({ outputPath: join(site, 'pagefind') });
          if (written.errors.length > 0) throw new Error(`Pagefind failed to write its files: ${written.errors.join('; ')}`);
          logger.info(`indexed ${pages.length} page(s) for search`);
        } finally {
          await pagefind.close();
        }
      },
    },
  };
}
