import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { builtPages, buildSite, read } from './support/built-site.ts';
import { makeTempDir } from './support/temp-root.ts';

const pageCount = (dist: string): number => {
  const entry = JSON.parse(read(dist, 'pagefind/pagefind-entry.json')) as {
    languages: Record<string, { page_count: number }>;
  };
  return Object.values(entry.languages).reduce((sum, language) => sum + language.page_count, 0);
};

const EMPTY = { LETTURE_CONTENT_DIR: 'tests/fixtures/letture-empty', APPUNTI_CONTENT_DIR: 'tests/fixtures/letture-empty' };
const POPULATED = { LETTURE_CONTENT_DIR: 'tests/fixtures/letture-post', APPUNTI_CONTENT_DIR: 'tests/fixtures/appunti' };

test('with no readings or notes, no page is marked and the index is empty, not full of site pages', () => {
  assert.equal(builtPages(EMPTY).filter(({ html }) => html.includes('data-pagefind-body')).length, 0);
  const dist = buildSite(EMPTY);
  assert.ok(existsSync(join(dist, 'pagefind/pagefind-ui.js')), '/cerca/ still needs its UI files');
  assert.equal(pageCount(dist), 0);
});

test('the build warns when no page is marked for indexing', () => {
  const outDir = makeTempDir('simonepetta-empty-');
  const output = execFileSync('npx', ['astro', 'build', '--outDir', outDir], {
    env: { ...process.env, ...EMPTY },
    encoding: 'utf8',
    stdio: 'pipe',
  });
  assert.match(output, /no page is marked data-pagefind-body/);
});

test('with marked pages, no unmarked page is in the index', () => {
  const dist = buildSite(POPULATED);
  const pages = builtPages(POPULATED);
  const marked = pages.filter(({ html }) => html.includes('data-pagefind-body'));
  assert.ok(marked.length > 0 && marked.length < pages.length, 'the build must mix marked and unmarked pages');
  assert.equal(pageCount(dist), marked.length);
});
