import assert from 'node:assert/strict';
import { test } from 'node:test';
import { personJsonLd } from '../src/lib/person-json-ld.ts';

test('builds a schema.org Person with both sameAs URLs (SPEC.md §8)', () => {
  const ld = personJsonLd('https://simonepetta.com/');
  assert.equal(ld['@context'], 'https://schema.org');
  assert.equal(ld['@type'], 'Person');
  assert.equal(ld.name, 'Simone Petta');
  assert.equal(ld.url, 'https://simonepetta.com/');
  assert.deepEqual(ld.sameAs, ['https://github.com/Simi24', 'https://www.linkedin.com/in/simone-paolo-petta/']);
});
