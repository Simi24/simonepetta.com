import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LetturaSchemaError, parseLettura } from '../src/schemas/lettura.ts';

const valid = () => ({
  titolo: 'Il nome della rosa',
  autore: 'Umberto Eco',
  stato: 'letto' as const,
  finito: '2026-05-01',
});

test('accepts a minimal valid book', () => {
  const lettura = parseLettura(valid());
  assert.equal(lettura.titolo, 'Il nome della rosa');
  assert.equal(lettura.autore, 'Umberto Eco');
  assert.equal(lettura.stato, 'letto');
});

test('rejects a missing titolo', () => {
  const { titolo, ...rest } = valid();
  assert.throws(() => parseLettura(rest), LetturaSchemaError);
});

test('rejects a missing autore', () => {
  const { autore, ...rest } = valid();
  assert.throws(() => parseLettura(rest), LetturaSchemaError);
});

test('rejects an unknown key', () => {
  assert.throws(
    () => parseLettura({ ...valid(), rating: 5 }),
    (error: unknown) => error instanceof LetturaSchemaError && error.issues.some((i) => i.includes('rating')),
  );
});

test('rejects a stato outside the enum', () => {
  assert.throws(() => parseLettura({ ...valid(), stato: 'in-lettura' }), LetturaSchemaError);
});

test('requires finito for stato letto', () => {
  const { finito, ...rest } = valid();
  assert.throws(() => parseLettura(rest), LetturaSchemaError);
});

test('forbids finito for stato in-corso', () => {
  assert.throws(
    () => parseLettura({ titolo: 'T', autore: 'A', stato: 'in-corso', finito: '2026-01-01' }),
    LetturaSchemaError,
  );
});

test('allows finito for stato abbandonato but does not require it', () => {
  const abandoned = parseLettura({ titolo: 'T', autore: 'A', stato: 'abbandonato' });
  assert.equal(abandoned.finito, undefined);
  const abandonedWithDate = parseLettura({
    titolo: 'T',
    autore: 'A',
    stato: 'abbandonato',
    finito: '2026-01-01',
  });
  assert.equal(abandonedWithDate.finito, '2026-01-01');
});

test('forbids voto for stato in-corso', () => {
  assert.throws(
    () => parseLettura({ titolo: 'T', autore: 'A', stato: 'in-corso', voto: 4 }),
    LetturaSchemaError,
  );
});

test('accepts half-point grades', () => {
  const lettura = parseLettura({ ...valid(), voto: 3.5 });
  assert.equal(lettura.voto, 3.5);
});

test('rejects a grade that is not a multiple of 0.5', () => {
  assert.throws(() => parseLettura({ ...valid(), voto: 3.1 }), LetturaSchemaError);
});

test('rejects a grade out of the 1 to 5 range', () => {
  assert.throws(() => parseLettura({ ...valid(), voto: 5.5 }), LetturaSchemaError);
});

test('rejects a grade written as a string modifier', () => {
  assert.throws(() => parseLettura({ ...valid(), voto: '3,5+' }), LetturaSchemaError);
});

test('rejects a non-integer pagine', () => {
  assert.throws(() => parseLettura({ ...valid(), pagine: 250.5 }), LetturaSchemaError);
});

test('accepts a valid pagine and anno_opera', () => {
  const lettura = parseLettura({ ...valid(), pagine: 400, anno_opera: 1980 });
  assert.equal(lettura.pagine, 400);
  assert.equal(lettura.anno_opera, 1980);
});

test('rejects an invalid calendar date', () => {
  assert.throws(() => parseLettura({ ...valid(), finito: '2026-02-30' }), LetturaSchemaError);
});

test('accepts a date parsed by YAML as a Date object', () => {
  const lettura = parseLettura({ ...valid(), finito: new Date('2026-05-01T00:00:00.000Z') });
  assert.equal(lettura.finito, '2026-05-01');
});
