import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runAndListLeftovers } from '../scripts/ci/temp-leaks.ts';

const node = process.execPath;

test('a passing test file leaves nothing in the temp dir', async () => {
  const { leftovers, exitCode } = await runAndListLeftovers(node, ['--test', 'tests/corso-meta.test.ts']);
  assert.equal(exitCode, 0);
  assert.deepEqual(leftovers, []);
});

test('a run that fails leaves nothing in the temp dir', async () => {
  const { leftovers, exitCode } = await runAndListLeftovers(node, ['tests/fixtures/temp-root/fail.ts']);
  assert.notEqual(exitCode, 0);
  assert.deepEqual(leftovers, []);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  test(`a run interrupted by ${signal} leaves nothing in the temp dir`, async () => {
    const { leftovers } = await runAndListLeftovers(node, ['tests/fixtures/temp-root/hang.ts'], {
      signal,
      signalWhenOutput: 'ready',
    });
    assert.deepEqual(leftovers, []);
  });
}
