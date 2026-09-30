import type { AstroIntegration } from 'astro';
import { LETTURA_CONTENT_DIR } from '../../config/lettura-content-dir.ts';
import { SAVE_PATH } from './constants.ts';
import { createSaveHandler } from './request-handler.ts';

/**
 * The local writing desk (SPEC.md §6.4): `/scrivi` and its save endpoint exist only under
 * `astro dev`. Neither is registered for `build` or `preview`, so nothing of the desk reaches
 * the production bundle.
 */
export function scrivania(): AstroIntegration {
  return {
    name: 'scrivania',
    hooks: {
      'astro:config:setup': ({ command, injectRoute }) => {
        if (command !== 'dev') return;
        injectRoute({
          pattern: '/scrivi',
          entrypoint: new URL('./scrivi.astro', import.meta.url),
          prerender: false,
        });
      },
      'astro:server:setup': ({ server, refreshContent }) => {
        const handleSave = createSaveHandler({
          contentDir: LETTURA_CONTENT_DIR,
          onSaved: async () => {
            // `loaders` filters by the loader's own name (e.g. "glob-loader"), not the collection
            // key: naming "letture" here would silently match nothing and skip the refresh.
            await refreshContent?.({});
          },
        });
        server.middlewares.use(SAVE_PATH, handleSave);
      },
    },
  };
}
