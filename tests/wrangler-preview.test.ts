import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { interpretUpload } from '../scripts/ci/wrangler-preview.ts';

test('extracts the preview URL from a successful version-upload entry', () => {
  const ndjson = [
    JSON.stringify({ type: 'wrangler-session', timestamp: 't' }),
    JSON.stringify({
      type: 'version-upload',
      version_id: 'v1-abc',
      preview_url: 'https://v1-abc-simonepetta-com.example.workers.dev',
      timestamp: 't',
    }),
  ].join('\n');

  const result = interpretUpload(ndjson);

  assert.equal(result.status, 'uploaded');
  assert.equal(result.previewUrl, 'https://v1-abc-simonepetta-com.example.workers.dev');
});

test('treats "Worker does not yet exist" as worker-missing, the expected first-PR case', () => {
  // The exact wrangler 4.145.0 command-failed entry observed on this repo's
  // own first PR (no `error` object: `message` sits at the top level).
  const ndjson = JSON.stringify({
    type: 'command-failed',
    version: 1,
    message:
      'You cannot upload a new version of a Worker that does not yet exist. Please run the `deploy` command first.',
    timestamp: 't',
  });

  const result = interpretUpload(ndjson);

  assert.equal(result.status, 'worker-missing');
  assert.equal(result.previewUrl, '');
});

test('a real upload failure is reported, not swallowed as worker-missing', () => {
  const ndjson = JSON.stringify({
    type: 'command-failed',
    version: 1,
    message: 'Authentication error',
    timestamp: 't',
  });

  const result = interpretUpload(ndjson);

  assert.equal(result.status, 'failed');
  assert.match(result.message, /Authentication error/);
});

test('no recognizable output is a failure, never a silent skip', () => {
  const result = interpretUpload('not json\n');

  assert.equal(result.status, 'failed');
});

test('a version-upload without a preview URL is a failure, never an empty comment', () => {
  const ndjson = JSON.stringify({ type: 'version-upload', version_id: 'v1-abc', timestamp: 't' });

  const result = interpretUpload(ndjson);

  assert.equal(result.status, 'failed');
  assert.equal(result.previewUrl, '');
  assert.match(result.message, /preview/i);
});

test('the preview URL is read from its own field, not from any URL in the entry', () => {
  const ndjson = JSON.stringify({
    type: 'version-upload',
    worker_name: 'simonepetta-com',
    docs: 'https://developers.cloudflare.com/workers/',
    preview_url: 'https://v1-abc-simonepetta-com.example.workers.dev',
    timestamp: 't',
  });

  assert.equal(interpretUpload(ndjson).previewUrl, 'https://v1-abc-simonepetta-com.example.workers.dev');
});

test('an entry whose only URL sits in another field is not a preview URL', () => {
  const ndjson = JSON.stringify({
    type: 'version-upload',
    docs: 'https://developers.cloudflare.com/workers/',
    timestamp: 't',
  });

  assert.equal(interpretUpload(ndjson).status, 'failed');
});

const cli = fileURLToPath(new URL('../scripts/ci/wrangler-preview.ts', import.meta.url));
const statusGuard = fileURLToPath(new URL('../scripts/ci/require-preview-status.ts', import.meta.url));

test('the CLI prints its outputs even when its path needs URL encoding', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wrangler preview '));
  try {
    const script = join(dir, 'wrangler-preview.ts');
    copyFileSync(cli, script);
    const output = join(dir, 'wrangler-output.ndjson');
    writeFileSync(output, JSON.stringify({ type: 'version-upload', preview_url: 'https://v1.example.workers.dev' }));

    const run = spawnSync(process.execPath, [script, output], { encoding: 'utf8' });

    assert.equal(run.status, 0);
    assert.match(run.stdout, /^status=uploaded$/m);
    assert.match(run.stdout, /^preview-url=https:\/\/v1\.example\.workers\.dev$/m);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the status guard fails the step on an empty or unknown status', () => {
  for (const status of ['', 'unexpected']) {
    const run = spawnSync(process.execPath, [statusGuard, status], { encoding: 'utf8' });
    assert.equal(run.status, 1, `status "${status}" must fail`);
    assert.match(run.stdout, /::error::/);
  }
});

test('the status guard passes every status the workflow handles', () => {
  for (const status of ['uploaded', 'worker-missing', 'failed']) {
    const run = spawnSync(process.execPath, [statusGuard, status], { encoding: 'utf8' });
    assert.equal(run.status, 0, `status "${status}" must pass`);
  }
});
