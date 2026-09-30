import assert from 'node:assert/strict';
import { test } from 'node:test';
import { corsoDescription, corsoNotice, corsoTitle, degreeProgramme } from '../src/lib/corso-presentation.ts';
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

test('degreeProgramme reads the configured name for the level', () => {
  assert.equal(degreeProgramme('triennale'), 'Corso di Laurea in Informatica per la comunicazione digitale');
  assert.equal(degreeProgramme('magistrale'), 'Corso di Laurea Magistrale in Informatica');
});

test('corsoTitle carries the course, the programme and the university, with no em-dash', () => {
  const title = corsoTitle(corso);
  assert.match(title, /Probabilità e statistica/);
  assert.match(title, /Informatica per la comunicazione digitale/);
  assert.match(title, /Università degli Studi di Milano/);
  assert.doesNotMatch(title, /—/);
});

test('corsoDescription names the course kind and the academic year', () => {
  const description = corsoDescription(corso);
  assert.match(description, /^Corso di /);
  assert.match(description, /2019\/20/);
});

test('corsoDescription names a tesi as "Tesi", not "Corso"', () => {
  const tesi: Corso = { ...corso, tipo: 'tesi', anno: undefined, aa: '2022' };
  assert.match(corsoDescription(tesi), /^Tesi di /);
});

test('corsoNotice mentions the course for a corso', () => {
  assert.match(corsoNotice(corso), /del corso/);
});

test('corsoNotice mentions the thesis for a tesi', () => {
  const tesi: Corso = { ...corso, tipo: 'tesi', anno: undefined, aa: '2022' };
  assert.match(corsoNotice(tesi), /della tesi/);
});
