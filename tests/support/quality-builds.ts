/**
 * The site variants the quality gates (axe, byte budget) check: the production build plus
 * fixture-populated builds, so a populated shelf and its post pages are gated too, even
 * though nothing is published to `src/content/letture/` yet (SPEC.md §12).
 */
export const QUALITY_BUILDS: readonly { label: string; env: Record<string, string> }[] = [
  { label: 'production', env: {} },
  { label: 'letture fixtures', env: { LETTURE_CONTENT_DIR: 'tests/fixtures/letture' } },
  { label: 'letture post fixtures', env: { LETTURE_CONTENT_DIR: 'tests/fixtures/letture-post' } },
  // A PDF-state course (with fonti), a scanned course, and an unpublished one, so every
  // course-page shape is gated too (SPEC.md §12), even before any real course ships.
  { label: 'appunti fixtures', env: { APPUNTI_CONTENT_DIR: 'tests/fixtures/appunti' } },
  // A real token, indexable (SPEC.md §12.4): the only build where the beacon actually renders,
  // so the gates cover it too, not just the (always-off) production default.
  { label: 'analytics beacon', env: { CLOUDFLARE_BEACON_TOKEN: 'quality-gate-token', SITE_INDEXABLE: 'true' } },
];
