import assert from 'node:assert/strict';
import { test } from 'node:test';
import { insertOutlineHeading } from '../src/integrations/scrivania/client/outline.ts';

test('inserts the heading alone on an empty sheet', () => {
  assert.equal(insertOutlineHeading('', 'A cosa si collega'), '## A cosa si collega\n\n');
});

test('adds a blank line before the heading when the text does not already end with one', () => {
  assert.equal(insertOutlineHeading('Ho iniziato a leggerlo ieri.', 'A cosa si collega'), 'Ho iniziato a leggerlo ieri.\n\n## A cosa si collega\n\n');
});

test('adds only one newline when the text already ends with a single one', () => {
  assert.equal(insertOutlineHeading('Riga.\n', 'A cosa si collega'), 'Riga.\n\n## A cosa si collega\n\n');
});

test('never doubles the blank line when the text already ends with one', () => {
  assert.equal(insertOutlineHeading('Riga.\n\n', 'A cosa si collega'), 'Riga.\n\n## A cosa si collega\n\n');
});
