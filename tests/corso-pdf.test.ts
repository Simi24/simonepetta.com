import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertPdfSize, PDF_CAP_BYTES } from '../src/lib/corso-pdf.ts';

test('the cap is 25 MiB (SPEC.md §7.2)', () => {
  assert.equal(PDF_CAP_BYTES, 25 * 1024 * 1024);
});

test('accepts a PDF exactly at the cap', () => {
  assert.doesNotThrow(() => assertPdfSize(PDF_CAP_BYTES, 'un-corso'));
});

test('accepts a PDF under the cap', () => {
  assert.doesNotThrow(() => assertPdfSize(1024, 'un-corso'));
});

test('throws for a PDF over the cap, naming the course', () => {
  assert.throws(() => assertPdfSize(PDF_CAP_BYTES + 1, 'un-corso'), /un-corso/);
});
