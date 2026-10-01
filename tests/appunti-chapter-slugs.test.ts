import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assignChapterSlugs, kebabCase } from '../pipeline/chapter-slugs.ts';

test('kebab-cases an Italian title: lowercase, no accents, no punctuation', () => {
  assert.equal(kebabCase('Variabili aleatorie continue'), 'variabili-aleatorie-continue');
  assert.equal(kebabCase("L'universo è più grande: e (forse) infinito!"), 'l-universo-e-piu-grande-e-forse-infinito');
  assert.equal(kebabCase('  Pattern   Paralleli  '), 'pattern-paralleli');
});

test('a first conversion names each chapter <number>-<kebab-title>', () => {
  const slugs = assignChapterSlugs(
    [
      { numero: 1, titolo: 'Introduzione' },
      { numero: 2, titolo: 'Modello di programmazione CUDA' },
    ],
    [],
  );
  assert.deepEqual(slugs, ['1-introduzione', '2-modello-di-programmazione-cuda']);
});

test('a later run reuses the recorded slug for a chapter with the same title', () => {
  const previous = [
    { numero: 1, titolo: 'Introduzione', slug: '1-introduzione' },
    { numero: 2, titolo: 'Memorie', slug: '2-memorie' },
  ];
  const slugs = assignChapterSlugs(
    [
      { numero: 1, titolo: 'Introduzione', },
      { numero: 2, titolo: 'Memorie' },
    ],
    previous,
  );
  assert.deepEqual(slugs, ['1-introduzione', '2-memorie']);
});

test('a renamed chapter keeps its URL', () => {
  const slugs = assignChapterSlugs(
    [{ numero: 1, titolo: 'Introduzione generale' }],
    [{ numero: 1, titolo: 'Introduzione', slug: '1-introduzione' }],
  );
  assert.deepEqual(slugs, ['1-introduzione']);
});

test('a chapter inserted before the others does not steal their URLs', () => {
  const previous = [
    { numero: 1, titolo: 'Introduzione', slug: '1-introduzione' },
    { numero: 2, titolo: 'Memorie', slug: '2-memorie' },
  ];
  const slugs = assignChapterSlugs(
    [
      { numero: 1, titolo: 'Introduzione' },
      { numero: 2, titolo: 'Modello di esecuzione' },
      { numero: 3, titolo: 'Memorie' },
    ],
    previous,
  );
  assert.deepEqual(slugs, ['1-introduzione', '2-modello-di-esecuzione', '2-memorie']);
});

test('two chapters with the same title and number never share a slug', () => {
  const slugs = assignChapterSlugs(
    [
      { numero: 1, titolo: 'Appendice' },
      { numero: 1, titolo: 'Appendice' },
    ],
    [],
  );
  assert.equal(new Set(slugs).size, 2);
});
