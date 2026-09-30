import assert from 'node:assert/strict';
import { test } from 'node:test';
import { corsoJsonLd } from '../src/lib/corso-json-ld.ts';
import type { Corso } from '../src/schemas/corso.ts';

const corso: Corso = {
  titolo: 'Probabilità e statistica',
  tipo: 'corso',
  livello: 'triennale',
  anno: 2,
  aa: '2019/20',
  fonte: 'overleaf',
  pubblicato: true,
};

test('builds a schema.org LearningResource with the course facts', () => {
  const ld = corsoJsonLd(corso, 'https://simonepetta.com/appunti/probabilita-e-statistica/');
  assert.equal(ld['@context'], 'https://schema.org');
  assert.equal(ld['@type'], 'LearningResource');
  assert.equal(ld.name, 'Probabilità e statistica');
  assert.equal(ld.url, 'https://simonepetta.com/appunti/probabilita-e-statistica/');
  assert.equal(ld.inLanguage, 'it');
  assert.equal(ld.educationalLevel, 'Corso di Laurea in Informatica per la comunicazione digitale');
  assert.match(ld.about, /Università degli Studi di Milano/);
});

test('has a stable @id derived from the given url', () => {
  const ld = corsoJsonLd(corso, 'https://simonepetta.com/appunti/probabilita-e-statistica/');
  assert.equal(ld['@id'], 'https://simonepetta.com/appunti/probabilita-e-statistica/#corso');
});
