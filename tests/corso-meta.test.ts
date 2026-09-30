import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { readCorsoMeta } from '../src/lib/corso-meta.ts';

test('reads a course’s page count from its meta.json', () => {
  const dir = mkdtempSync(join(tmpdir(), 'corso-meta-'));
  mkdirSync(join(dir, 'un-corso'));
  writeFileSync(join(dir, 'un-corso', 'meta.json'), JSON.stringify({ pagine: 205 }));
  assert.deepEqual(readCorsoMeta(dir, 'un-corso'), { pagine: 205 });
});

test('returns undefined when the course has no meta.json yet', () => {
  const dir = mkdtempSync(join(tmpdir(), 'corso-meta-'));
  mkdirSync(join(dir, 'un-corso'));
  assert.equal(readCorsoMeta(dir, 'un-corso'), undefined);
});

test('rejects a meta.json with a non-positive page count', () => {
  const dir = mkdtempSync(join(tmpdir(), 'corso-meta-'));
  mkdirSync(join(dir, 'un-corso'));
  writeFileSync(join(dir, 'un-corso', 'meta.json'), JSON.stringify({ pagine: 0 }));
  assert.throws(() => readCorsoMeta(dir, 'un-corso'));
});

test('rejects malformed JSON', () => {
  const dir = mkdtempSync(join(tmpdir(), 'corso-meta-'));
  mkdirSync(join(dir, 'un-corso'));
  writeFileSync(join(dir, 'un-corso', 'meta.json'), '{ not json');
  assert.throws(() => readCorsoMeta(dir, 'un-corso'));
});
