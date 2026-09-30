import { execFileSync } from 'node:child_process';

/**
 * The ISO date (`YYYY-MM-DD`) of the last commit touching `file`, from `cwd`'s git history
 * (SPEC.md §12.3; the `site` workflow checks out with full history for this, §11). Falls back
 * to today for a file with no commit yet, so a new page in a local build still gets a `lastmod`.
 */
export function gitLastmod(file: string, cwd: string = process.cwd()): string {
  let output = '';
  try {
    output = execFileSync('git', ['log', '-1', '--format=%cI', '--', file], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    // No commits at all yet (a brand new repo): fall through to today, same as a file with no history.
  }
  return (output || new Date().toISOString()).slice(0, 10);
}
