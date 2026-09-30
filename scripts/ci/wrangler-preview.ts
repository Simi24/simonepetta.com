import { existsSync, readFileSync } from 'node:fs';

type WranglerEntry = { type?: string; message?: string; error?: { message?: string } } & Record<string, unknown>;

type UploadResult = {
  status: 'uploaded' | 'worker-missing' | 'failed';
  previewUrl: string;
  message: string;
};

function parseNdjson(ndjson: string): WranglerEntry[] {
  return ndjson
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as WranglerEntry];
      } catch {
        return [];
      }
    });
}

function findUrl(entry: WranglerEntry): string {
  const match = JSON.stringify(entry).match(/https?:\/\/[^"\\]+/);
  return match ? match[0] : '';
}

// SPEC.md §11 / the site workflow: `wrangler versions upload` fails the
// first time, before `main` has ever run `wrangler deploy` to create the
// Worker (observed with wrangler 4.145.0: "You cannot upload a new version
// of a Worker that does not yet exist. Please run the `deploy` command
// first."). Match on the stable part of that message, not the whole string.
function isMissingWorker(entry: WranglerEntry): boolean {
  const message = entry.message ?? entry.error?.message ?? '';
  return message.includes('does not yet exist');
}

/**
 * Interprets Wrangler's ND-JSON output file (`WRANGLER_OUTPUT_FILE_PATH`) from
 * `wrangler versions upload`, for the `site` workflow's PR preview step.
 */
export function interpretUpload(ndjson: string): UploadResult {
  const entries = parseNdjson(ndjson);
  const upload = [...entries].reverse().find((entry) => entry.type === 'version-upload');
  if (upload) {
    return { status: 'uploaded', previewUrl: findUrl(upload), message: '' };
  }

  const failure = [...entries].reverse().find((entry) => entry.type === 'command-failed');
  if (failure && isMissingWorker(failure)) {
    return { status: 'worker-missing', previewUrl: '', message: '' };
  }

  const message = failure
    ? (failure.message ?? failure.error?.message ?? JSON.stringify(failure))
    : 'wrangler produced no version-upload or command-failed entry';
  return { status: 'failed', previewUrl: '', message };
}

// CLI: reads the ND-JSON file wrangler wrote and prints `$GITHUB_OUTPUT` lines.
if (import.meta.url === `file://${process.argv[1]}`) {
  const path = process.argv[2];
  if (!path) {
    console.error('usage: wrangler-preview.ts <ndjson-file>');
    process.exit(2);
  }
  const ndjson = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const { status, previewUrl, message } = interpretUpload(ndjson);
  console.log(`status=${status}`);
  console.log(`preview-url=${previewUrl}`);
  console.log(`message=${message.replace(/\n/g, ' ')}`);
}
