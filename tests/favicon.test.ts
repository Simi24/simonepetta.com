import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { builtPages, buildSite, read } from './support/built-site.ts';

const ICON_LINKS = [
  /<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml"\s*\/?>/,
  /<link rel="icon" href="\/favicon\.ico" sizes="32x32"\s*\/?>/,
  /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png"\s*\/?>/,
];

test('every built page links the SVG icon, the ICO and the apple-touch icon', () => {
  const pages = builtPages();
  assert.ok(pages.length > 0, 'no pages were built');
  for (const { page, html } of pages) {
    for (const link of ICON_LINKS) assert.match(html, link, `${page} misses ${link}`);
  }
});

test('each linked icon is built at the root of dist', () => {
  const dist = buildSite();
  for (const file of ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png']) {
    assert.ok(existsSync(join(dist, file)), `${file} was not built`);
  }
});

test('the SVG icon draws the glyph as a path: no text, no font reference', () => {
  const svg = read(buildSite(), 'favicon.svg');
  assert.match(svg, /<path\b[^>]*\sd="[^"]+"/);
  assert.doesNotMatch(svg, /<text\b/i);
  assert.doesNotMatch(svg, /font/i);
});

test('the ICO holds a 16 px and a 32 px image', () => {
  const ico = readFileSync(join(buildSite(), 'favicon.ico'));
  assert.equal(ico.readUInt16LE(0), 0, 'ICO reserved field');
  assert.equal(ico.readUInt16LE(2), 1, 'ICO type');
  const count = ico.readUInt16LE(4);
  const sizes = Array.from({ length: count }, (_, i) => ico[6 + i * 16] || 256).sort((a, b) => a - b);
  assert.deepEqual(sizes, [16, 32]);
});

test('the apple-touch icon is a 180 px PNG', () => {
  const png = readFileSync(join(buildSite(), 'apple-touch-icon.png'));
  assert.equal(png.subarray(1, 4).toString('latin1'), 'PNG');
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [180, 180]);
});
