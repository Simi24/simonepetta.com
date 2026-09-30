// @ts-check
import { defineConfig, envField } from 'astro/config';

export default defineConfig({
  site: 'https://simonepetta.com',
  output: 'static',
  trailingSlash: 'always',
  env: {
    schema: {
      // Off until the v0 launch, and never on previews: pages carry noindex (SPEC.md §11).
      SITE_INDEXABLE: envField.boolean({ context: 'server', access: 'public', default: false }),
    },
  },
});
