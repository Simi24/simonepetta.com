import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_PAGINE,
  groupByYear,
  notebookHeightPx,
  pileLabel,
  sortTheses,
  type IndexCourse,
} from '../src/lib/appunti-index.ts';

const course = (id: string, livello: 'triennale' | 'magistrale', anno: number, titolo = id): IndexCourse => ({
  id,
  titolo,
  livello,
  anno,
  stato: 'pdf',
  pagine: 100,
});

test('notebook height is the prototype’s 1.35rem plus one pixel per 8 pages', () => {
  assert.equal(notebookHeightPx(80), 10);
  assert.equal(notebookHeightPx(140), 18); // 17.5 rounds up
  assert.equal(notebookHeightPx(56), 7);
});

test('more pages make a thicker notebook', () => {
  assert.ok(notebookHeightPx(300) > notebookHeightPx(60));
});

test('a course without a page count gets the default thickness', () => {
  assert.equal(notebookHeightPx(undefined), notebookHeightPx(DEFAULT_PAGINE));
  assert.ok(DEFAULT_PAGINE > 0);
});

test('piles are one per year of study, triennale before magistrale, year ascending', () => {
  const piles = groupByYear([
    course('m2', 'magistrale', 2),
    course('t3', 'triennale', 3),
    course('m1', 'magistrale', 1),
    course('t1', 'triennale', 1),
  ]);
  assert.deepEqual(
    piles.map((pile) => [pile.livello, pile.anno]),
    [
      ['triennale', 1],
      ['triennale', 3],
      ['magistrale', 1],
      ['magistrale', 2],
    ],
  );
});

test('a pile holds only its year’s courses, ordered by title', () => {
  const piles = groupByYear([
    course('b', 'triennale', 1, 'Basi di dati'),
    course('x', 'triennale', 2, 'Altro'),
    course('a', 'triennale', 1, 'Analisi'),
  ]);
  assert.deepEqual(
    piles[0]?.courses.map((c) => c.id),
    ['a', 'b'],
  );
  assert.equal(piles[1]?.courses.length, 1);
});

test('no courses, no piles', () => {
  assert.deepEqual(groupByYear([]), []);
});

test('a pile is labelled with its year and level', () => {
  assert.deepEqual(pileLabel({ livello: 'triennale', anno: 1 }), { year: '1° anno', level: 'triennale' });
  assert.deepEqual(pileLabel({ livello: 'magistrale', anno: 2 }), { year: '2° anno', level: 'magistrale' });
});

test('theses are ordered magistrale first, as in the prototype', () => {
  const tesi = (id: string, livello: 'triennale' | 'magistrale') => ({ id, livello });
  assert.deepEqual(
    sortTheses([tesi('tri', 'triennale'), tesi('mag', 'magistrale')]).map((t) => t.id),
    ['mag', 'tri'],
  );
});
