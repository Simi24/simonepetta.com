import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { makeTempDir } from './temp-root.ts';

const builds = new Map<string, string>();

/** Builds the site once per environment into a temporary directory and returns its path. */
export function buildSite(env: Record<string, string> = {}): string {
  const key = JSON.stringify(env);
  const cached = builds.get(key);
  if (cached) return cached;
  const outDir = makeTempDir('simonepetta-build-');
  execFileSync('npx', ['astro', 'build', '--outDir', outDir], {
    env: { ...process.env, ...env },
    stdio: 'pipe',
  });
  builds.set(key, outDir);
  return outDir;
}

/** Every file under `dir` with the given extension, as paths relative to `dir`. */
export function filesWithExtension(dir: string, extension: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith(extension))
    .map((file) => relative(dir, join(dir, file)));
}

/** The built HTML pages for an environment, with their contents. */
export function builtPages(env: Record<string, string> = {}): { page: string; html: string }[] {
  const dist = buildSite(env);
  return filesWithExtension(dist, '.html').map((page) => ({ page, html: read(dist, page) }));
}

export function read(dir: string, file: string): string {
  return readFileSync(join(dir, file), 'utf8');
}
