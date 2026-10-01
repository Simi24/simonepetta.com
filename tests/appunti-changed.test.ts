import assert from 'node:assert/strict';
import { test } from 'node:test';
import { notesChanged } from '../scripts/ci/appunti-changed.ts';

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
