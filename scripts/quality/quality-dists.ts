import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { buildSite } from '../../tests/support/built-site.ts';
import { QUALITY_BUILDS } from '../../tests/support/quality-builds.ts';

export interface QualityDist {
  label: string;
  dist: string;
}

/**
 * Whether the gates must (re)build `dist` before checking it. Standalone, they always build
 * fresh: a stale `dist` from an earlier source tree must never pass silently. Only with
 * `QUALITY_GATE_REUSE_DIST=1` — set by the `site` workflow and the verify commands, right
 * after their own `npm run build` — is an existing `dist` trusted as-is.
 */
export const shouldBuildFreshDist = ({
  reuseDist,
  distExists,
}: {
  reuseDist: boolean;
  distExists: boolean;
}): boolean => !reuseDist || !distExists;

/**
 * Every build the quality gates (budget, axe) check: production at `dist` (the very directory
 * the workflow uploads and deploys, so what is gated is what ships) plus the fixture-populated
 * builds, so a page type like the post page is gated even before any real content ships.
 */
export function qualityDists(reuseDist: boolean): QualityDist[] {
  const productionDist = 'dist';
  if (shouldBuildFreshDist({ reuseDist, distExists: existsSync(productionDist) })) {
    execFileSync('npx', ['astro', 'build', '--outDir', productionDist], { stdio: 'inherit' });
  }
  return [
    { label: 'production', dist: productionDist },
    ...QUALITY_BUILDS.filter((build) => build.label !== 'production').map((build) => ({
      label: build.label,
      dist: buildSite(build.env),
    })),
  ];
}
