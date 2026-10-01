import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { coursesWithPdf, parsePdfinfoPages, writeCorsoMeta } from '../pipeline/appunti-meta.ts';
import { makeTempDir } from './support/temp-root.ts';

/**
 * Whether `pdfinfo` (poppler) is on `PATH`. The `site` workflow does not install it (only the
 * `appunti` workflow installs it); locally it's at `/opt/homebrew/bin/pdfinfo` on this machine.
 * Tests that shell out to the real binary are skipped, not failed, when it's missing.
 */
function hasPdfinfo(): boolean {
  try {
    execFileSync('pdfinfo', ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const PDFINFO_SKIP = hasPdfinfo() ? false : 'pdfinfo (poppler) is not installed on PATH';

// A real `pdfinfo` excerpt (poppler), independent of the parser: the expected value is read
// off this literal, not recomputed the way the parser does.
const SAMPLE_PDFINFO_OUTPUT = `Page size:       200 x 200 pts
Pages:           42
Encrypted:       no
`;

test('parses the page count off a real pdfinfo excerpt', () => {
  assert.equal(parsePdfinfoPages(SAMPLE_PDFINFO_OUTPUT), 42);
});

test('throws when pdfinfo output has no Pages line', () => {
  assert.throws(() => parsePdfinfoPages('Encrypted:       no\n'));
});

function fixtureContentDir(): string {
  const dir = makeTempDir('appunti-meta-');
  for (const slug of ['una-pagina', 'tre-pagine']) {
    mkdirSync(join(dir, slug), { recursive: true });
    copyFileSync(join(import.meta.dirname, 'fixtures/appunti-pdf', `${slug}.pdf`), join(dir, slug, `${slug}.pdf`));
  }
  return dir;
}

test('writes meta.json with the PDF’s real page count (a one-page fixture)', { skip: PDFINFO_SKIP }, () => {
  const dir = fixtureContentDir();
  const meta = writeCorsoMeta(dir, 'una-pagina');
  assert.equal(meta.pagine, 1);
  const written = JSON.parse(readFileSync(join(dir, 'una-pagina', 'meta.json'), 'utf8'));
  assert.deepEqual(written, { pagine: 1 });
});

test('writes meta.json matching a three-page fixture', { skip: PDFINFO_SKIP }, () => {
  const dir = fixtureContentDir();
  const meta = writeCorsoMeta(dir, 'tre-pagine');
  assert.equal(meta.pagine, 3);
});

test('coursesWithPdf lists only directories that have a <slug>.pdf', () => {
  const dir = fixtureContentDir();
  assert.deepEqual(coursesWithPdf(dir).sort(), ['tre-pagine', 'una-pagina']);
});
