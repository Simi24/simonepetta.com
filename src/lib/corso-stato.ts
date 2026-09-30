import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { FonteManifesto } from '../schemas/corso.ts';

export const STATI_CORSO = ['scansione', 'html', 'pdf'] as const;
export type StatoCorso = (typeof STATI_CORSO)[number];

/**
 * A course's state is derived, never declared (SPEC.md §7.2): `scansione` when its source is
 * a scan (it stays PDF forever, even if a `build/` later showed up by mistake), `html` once a
 * valid conversion exists, `pdf` otherwise.
 */
export function deriveStato({ fonte, hasValidBuild }: { fonte: FonteManifesto; hasValidBuild: boolean }): StatoCorso {
  if (fonte === 'scansione') return 'scansione';
  if (hasValidBuild) return 'html';
  return 'pdf';
}

/** Whether `<contentDir>/<slug>/build/meta.json` exists: the pipeline's record that conversion produced real output (SPEC.md §7.2, §7.3). */
export function hasValidBuild(contentDir: string, slug: string): boolean {
  return existsSync(join(contentDir, slug, 'build', 'meta.json'));
}
