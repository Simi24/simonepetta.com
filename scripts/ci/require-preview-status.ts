// The `site` workflow's preview steps each key off `steps.upload.outputs.status`. An empty or
// unknown status matches none of them and the job would pass without a preview, so fail loudly.
const KNOWN_STATUSES = ['uploaded', 'worker-missing', 'failed'];

const uploadStatus = process.argv[2] ?? '';
if (!KNOWN_STATUSES.includes(uploadStatus)) {
  console.log(`::error::the preview upload step produced no known status (got "${uploadStatus}")`);
  process.exit(1);
}
