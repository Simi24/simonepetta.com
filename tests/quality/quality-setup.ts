import { qualityDists } from '../../scripts/quality/quality-dists.ts';

/**
 * Playwright global setup: builds every quality build once, in this process, and hands the
 * directories to the specs (which enumerate their pages at load time) through the environment.
 */
export default function setup(): void {
  process.env['QUALITY_DISTS'] = JSON.stringify(qualityDists(process.env['QUALITY_GATE_REUSE_DIST'] === '1'));
}
