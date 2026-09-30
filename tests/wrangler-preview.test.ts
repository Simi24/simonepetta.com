import assert from 'node:assert/strict';
import { test } from 'node:test';
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
