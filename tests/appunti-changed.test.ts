import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { notesChanged, notesChangedBetween } from '../scripts/ci/appunti-changed.ts';
import { makeTempDir } from './support/temp-root.ts';

test('a change under appunti/ or pipeline/ means the notes changed', () => {
  assert.equal(notesChanged(['README.md', 'appunti/gpucomputing/meta.json']), true);
  assert.equal(notesChanged(['pipeline/leak-detector.ts']), true);
});

test('the workflow file itself counts, so editing it runs the checks it defines', () => {
  assert.equal(notesChanged(['.github/workflows/appunti.yml']), true);
});

test('nothing else does: the site, its tests and its other workflows', () => {
  assert.equal(notesChanged(['src/pages/index.astro', 'tests/appunti-build.test.ts', '.github/workflows/site.yml', 'SPEC.md']), false);
});

test('a path that only looks similar does not count', () => {
  assert.equal(notesChanged(['docs/appunti/x.md', 'src/pipeline/y.ts', 'appunti-notes.md']), false);
});

test('an empty change list is no change', () => {
  assert.equal(notesChanged([]), false);
});

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, stdio: 'ignore' });
}

test('a file moved out of appunti/ counts as a change, even though git sees a rename', () => {
  const repo = makeTempDir('appunti-changed-');
  git(repo, 'init', '-q');
  mkdirSync(join(repo, 'appunti/c'), { recursive: true });
  writeFileSync(join(repo, 'appunti/c/nota.md'), 'una nota abbastanza lunga perché git la riconosca come rinominata\n'.repeat(5));
  git(repo, 'add', '-A');
  git(repo, 'commit', '-qm', 'base');
  const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
  mkdirSync(join(repo, 'docs'));
  git(repo, 'mv', 'appunti/c/nota.md', 'docs/nota.md');
  git(repo, 'commit', '-qm', 'move');
  assert.equal(notesChangedBetween(base, 'HEAD', repo), true);
});

test('a diff touching only other paths is no change', () => {
  const repo = makeTempDir('appunti-changed-');
  git(repo, 'init', '-q');
  writeFileSync(join(repo, 'README.md'), 'a\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-qm', 'base');
  writeFileSync(join(repo, 'README.md'), 'b\n');
  git(repo, 'commit', '-qam', 'edit');
  assert.equal(notesChangedBetween('HEAD~1', 'HEAD', repo), false);
});
