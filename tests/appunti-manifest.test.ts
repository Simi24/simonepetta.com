import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readCorsoManifest } from '../pipeline/corso-manifest.ts';

const BASE = `titolo: "Fixture"
tipo: corso
livello: triennale
anno: 2
aa: "2021/22"
fonte: overleaf
`;

test('reads a manifest through the course schema, with comments, quotes and a list', () => {
  const corso = readCorsoManifest(`# nota\n${BASE}pubblicato: true # sì\nfonti:\n  - "Slide"\n  - Dispense\n`);
  assert.equal(corso.pubblicato, true);
  assert.equal(corso.anno, 2);
  assert.equal(corso.aa, '2021/22');
  assert.deepEqual(corso.fonti, ['Slide', 'Dispense']);
});

test('pubblicato: false is read as false, with its motivo', () => {
  assert.equal(readCorsoManifest(`${BASE}pubblicato: false\nmotivo: 'in attesa'\n`).pubblicato, false);
});

test('a "true" in quotes is rejected loudly, not read as published or silently dropped', () => {
  assert.throws(() => readCorsoManifest(`${BASE}pubblicato: "true"\n`), /pubblicato/);
});

test('a manifest the schema rejects fails, whatever the YAML looks like', () => {
  assert.throws(() => readCorsoManifest(`${BASE}pubblicato: true\nextra: 1\n`), /extra/);
  assert.throws(() => readCorsoManifest('pubblicato: true\n'), /titolo/);
});

test('a line that is not "key: value" is refused rather than skipped', () => {
  assert.throws(() => readCorsoManifest(`${BASE}pubblicato: true\n  nested: {a: 1}\n`), /line/);
});
