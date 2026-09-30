import { execFileSync } from 'node:child_process';

/**
 * The ISO date (`YYYY-MM-DD`) of the last commit touching any of `paths`, from `cwd`'s git
 * history (SPEC.md §12.3; the `site` workflow checks out with full history for this, §11).
 * Several paths give the latest commit across all of them (e.g. a page template plus the
 * content directory it renders): `git log` already takes more than one pathspec. Falls back to
 * today when none has a commit yet, so a new page in a local build still gets a `lastmod`.
 */
export function gitLastmod(paths: string | readonly string[], cwd: string = process.cwd()): string {
  const pathspecs = typeof paths === 'string' ? [paths] : paths;
  let output = '';
  try {
    output = execFileSync('git', ['log', '-1', '--format=%cI', '--', ...pathspecs], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    // No commits at all yet (a brand new repo): fall through to today, same as a file with no history.
  }
  return (output || new Date().toISOString()).slice(0, 10);
}
