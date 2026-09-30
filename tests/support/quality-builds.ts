/**
 * The site variants the quality gates (axe, byte budget) check: the production build plus
 * fixture-populated builds, so a populated shelf and its post pages are gated too, even
 * though nothing is published to `src/content/letture/` yet (SPEC.md §12).
 */
export const QUALITY_BUILDS: readonly { label: string; env: Record<string, string> }[] = [
  { label: 'production', env: {} },
  { label: 'letture fixtures', env: { LETTURE_CONTENT_DIR: 'tests/fixtures/letture' } },
  { label: 'letture post fixtures', env: { LETTURE_CONTENT_DIR: 'tests/fixtures/letture-post' } },
];
