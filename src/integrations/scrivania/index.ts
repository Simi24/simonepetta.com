import type { AstroConfig, AstroIntegration } from 'astro';
import { LETTURA_CONTENT_DIR } from '../../config/lettura-content-dir.ts';
import { PREVIEW_PATH, SAVE_PATH } from './constants.ts';
import { createPreviewHandler } from './preview.ts';
import { createSaveHandler } from './request-handler.ts';

const POST_COMPONENT_URL = new URL('../../components/lettura/Post.astro', import.meta.url);

/**
 * The local writing desk (SPEC.md §6.4): `/scrivi` and its save and preview endpoints exist only
 * under `astro dev`. None is registered for `build` or `preview`, so nothing of the desk reaches
 * the production bundle.
 */
export function scrivania(): AstroIntegration {
  let markdown: AstroConfig['markdown'];
  let image: AstroConfig['image'];
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
      'astro:config:done': ({ config }) => {
        markdown = config.markdown;
        image = config.image;
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

        const handlePreview = createPreviewHandler({
          server,
          markdown,
          image,
          postEntrypoint: POST_COMPONENT_URL.pathname,
        });
        server.middlewares.use(PREVIEW_PATH, handlePreview);
      },
    },
  };
}
