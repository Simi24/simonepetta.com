import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { gitLastmod } from '../src/lib/git-lastmod.ts';
import { makeTempDir } from './support/temp-root.ts';

/** A throwaway git repo, isolated from this repo's own history. */
function initRepo(): string {
  const dir = makeTempDir('git-lastmod-');
  execFileSync('git', ['init', '--quiet', '-b', 'main'], { cwd: dir, stdio: 'ignore' });
  return dir;
}

/** Commits `content` to `file` at an exact, controlled date (author and committer alike). */
function commit(dir: string, file: string, content: string, isoDateTime: string): void {
  mkdirSync(dirname(join(dir, file)), { recursive: true });
  writeFileSync(join(dir, file), content);
  execFileSync('git', ['add', file], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.email=test@test.invalid', '-c', 'user.name=Test', 'commit', '--quiet', '-m', 'x'], {
    cwd: dir,
    stdio: 'ignore',
    env: { ...process.env, GIT_AUTHOR_DATE: isoDateTime, GIT_COMMITTER_DATE: isoDateTime },
  });
}

test('returns the ISO date of the file’s last commit', () => {
  const dir = initRepo();
  commit(dir, 'a.txt', 'one', '2026-03-05T10:00:00');
  assert.equal(gitLastmod('a.txt', dir), '2026-03-05');
});

test('a later commit touching the same file updates the date', () => {
  const dir = initRepo();
  commit(dir, 'a.txt', 'one', '2026-03-05T10:00:00');
  commit(dir, 'a.txt', 'two', '2026-04-10T08:00:00');
  assert.equal(gitLastmod('a.txt', dir), '2026-04-10');
});

test('a commit to a different file does not change this file’s date', () => {
  const dir = initRepo();
  commit(dir, 'a.txt', 'one', '2026-03-05T10:00:00');
  commit(dir, 'b.txt', 'other', '2026-05-01T00:00:00');
  assert.equal(gitLastmod('a.txt', dir), '2026-03-05');
});

test('a file with no commit falls back to today', () => {
  const dir = initRepo();
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(gitLastmod('missing.txt', dir), today);
});

test('with several paths, returns the latest commit across all of them', () => {
  const dir = initRepo();
  commit(dir, 'a.txt', 'one', '2026-03-05T10:00:00');
  commit(dir, 'b.txt', 'other', '2026-05-01T00:00:00');
  assert.equal(gitLastmod(['a.txt', 'b.txt'], dir), '2026-05-01');
});

test('with several paths, the order given does not matter', () => {
  const dir = initRepo();
  commit(dir, 'a.txt', 'one', '2026-03-05T10:00:00');
  commit(dir, 'b.txt', 'other', '2026-05-01T00:00:00');
  assert.equal(gitLastmod(['b.txt', 'a.txt'], dir), '2026-05-01');
});

test('a directory is a valid pathspec: the latest commit inside it counts', () => {
  const dir = initRepo();
  commit(dir, 'content/one.md', 'one', '2026-01-10T00:00:00');
  commit(dir, 'content/two.md', 'two', '2026-06-20T00:00:00');
  assert.equal(gitLastmod('content', dir), '2026-06-20');
});

test('with several paths, none committed, falls back to today', () => {
  const dir = initRepo();
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(gitLastmod(['missing-a.txt', 'missing-b.txt'], dir), today);
});
