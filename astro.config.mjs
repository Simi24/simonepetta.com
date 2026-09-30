// @ts-check
import { defineConfig, envField } from 'astro/config';
import { pagefindIndex } from './src/integrations/pagefind/index.ts';
import { scrivania } from './src/integrations/scrivania/index.ts';

export default defineConfig({
  site: 'https://simonepetta.com',
  output: 'static',
  trailingSlash: 'always',
  // Dev-only writing desk (SPEC.md §6.4): no-ops outside `astro dev`.
  // Search index over the built pages (SPEC.md §7.3): runs after the build, so it sees the final HTML.
  integrations: [scrivania(), pagefindIndex()],
  env: {
    schema: {
      // Off until the v0 launch, and never on previews: pages carry noindex (SPEC.md §11).
      SITE_INDEXABLE: envField.boolean({ context: 'server', access: 'public', default: false }),
    },
  },
});
