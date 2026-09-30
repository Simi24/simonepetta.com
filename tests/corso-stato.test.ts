import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { deriveStato, hasValidBuild } from '../src/lib/corso-stato.ts';

test('a scansione source is always state "scansione"', () => {
  assert.equal(deriveStato({ fonte: 'scansione', hasValidBuild: false }), 'scansione');
});

test('a scansione source stays "scansione" even with a build/ present: scanned courses stay PDF forever', () => {
  assert.equal(deriveStato({ fonte: 'scansione', hasValidBuild: true }), 'scansione');
});

test('a non-scan source with a valid build/ is state "html"', () => {
  assert.equal(deriveStato({ fonte: 'overleaf', hasValidBuild: true }), 'html');
  assert.equal(deriveStato({ fonte: 'github', hasValidBuild: true }), 'html');
  assert.equal(deriveStato({ fonte: 'locale', hasValidBuild: true }), 'html');
});

test('a non-scan source with no build/ is state "pdf"', () => {
  assert.equal(deriveStato({ fonte: 'overleaf', hasValidBuild: false }), 'pdf');
});

test('hasValidBuild is false when the course directory has no build at all', () => {
  const dir = mkdtempSync(join(tmpdir(), 'corso-stato-'));
  mkdirSync(join(dir, 'un-corso'), { recursive: true });
  assert.equal(hasValidBuild(dir, 'un-corso'), false);
});

test('hasValidBuild is false when build/ exists but has no meta.json', () => {
  const dir = mkdtempSync(join(tmpdir(), 'corso-stato-'));
  mkdirSync(join(dir, 'un-corso', 'build'), { recursive: true });
  assert.equal(hasValidBuild(dir, 'un-corso'), false);
});

test('hasValidBuild is true once build/meta.json exists', () => {
  const dir = mkdtempSync(join(tmpdir(), 'corso-stato-'));
  mkdirSync(join(dir, 'un-corso', 'build'), { recursive: true });
  writeFileSync(join(dir, 'un-corso', 'build', 'meta.json'), '{}');
  assert.equal(hasValidBuild(dir, 'un-corso'), true);
});
