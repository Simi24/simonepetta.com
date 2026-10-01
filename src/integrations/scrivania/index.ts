import type { AstroConfig, AstroIntegration } from 'astro';
import { LETTURA_CONTENT_DIR } from '../../config/lettura-content-dir.ts';
import { PREVIEW_PATH, SAVE_PATH } from './constants.ts';
import { createPreviewHandler } from './preview.ts';
import { createReloadGate, type HotChannel } from './reload-gate.ts';
import { createSaveHandler } from './request-handler.ts';
import { fetchShelf, waitUntilServed } from './served.ts';

// About 2 s at most: the lag is a few ms, so this only runs out when the shelf cannot be read at all.
const SERVED_WAIT = { attempts: 100, intervalMs: 20 };

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
        const reloadGate = createReloadGate(server.environments.client.hot as unknown as HotChannel);
        const handleSave = createSaveHandler({
          contentDir: LETTURA_CONTENT_DIR,
          onSaved: (saved) =>
            // Astro reloads every open page when the content store is written, inside the refresh
            // and before `/scrivi/` serves the new content: those reloads wait for this to finish.
            reloadGate.during(async () => {
              // `loaders` filters by the loader's own name (e.g. "glob-loader"), not the collection
              // key: naming "letture" here would silently match nothing and skip the refresh.
              await refreshContent?.({});
              // The refresh resolves a few ms before the render path serves the new content.
              const base = server.resolvedUrls?.local[0];
              if (base === undefined) return;
              const pageUrl = new URL('scrivi/', base).href;
              await waitUntilServed(() => fetchShelf(pageUrl), saved, SERVED_WAIT);
            }),
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
