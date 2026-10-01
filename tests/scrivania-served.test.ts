import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shelfServes, waitUntilServed, type ServedBook } from '../src/integrations/scrivania/served.ts';

const saved = { slug: 'un-libro', titolo: 'Un libro', stato: 'letto', testo: 'Il testo.' };
const stale: ServedBook = { slug: 'un-libro', titolo: 'Un libro', stato: 'letto', testo: null };
const fresh: ServedBook = { ...stale, testo: 'Il testo.' };

test('a shelf serves a save only when the book has the saved state and text', () => {
  assert.equal(shelfServes([fresh], saved), true);
  assert.equal(shelfServes([stale], saved), false, 'the body is still the old one');
  assert.equal(shelfServes([], saved), false, 'the book is not on the shelf yet');
  assert.equal(shelfServes([{ ...fresh, stato: 'in-corso' }], saved), false);
});

test('a save without a text only needs the book on the shelf in its saved state', () => {
  assert.equal(shelfServes([stale], { slug: 'un-libro', titolo: 'Un libro', stato: 'letto' }), true);
});

test('waits through stale shelves and resolves on the first fresh one', async () => {
  const shelves = [[], [stale], [stale], [fresh]];
  let calls = 0;
  await waitUntilServed(() => Promise.resolve(shelves[calls++]!), saved, { attempts: 10, intervalMs: 0 });
  assert.equal(calls, 4);
});

test('gives up after the bounded number of attempts, saying what was not served', async () => {
  let calls = 0;
  await assert.rejects(
    waitUntilServed(() => (calls++, Promise.resolve([stale])), saved, { attempts: 5, intervalMs: 0 }),
    /Un libro/,
  );
  assert.equal(calls, 5);
});
