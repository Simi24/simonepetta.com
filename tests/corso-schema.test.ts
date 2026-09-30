import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CorsoSchemaError, parseCorso } from '../src/schemas/corso.ts';

const validCorso = () => ({
  titolo: 'Probabilità e statistica',
  tipo: 'corso' as const,
  livello: 'triennale' as const,
  anno: 2,
  aa: '2019/20',
  fonte: 'overleaf' as const,
  pubblicato: true,
});

const validTesi = () => ({
  titolo: 'Una tesi di esempio',
  tipo: 'tesi' as const,
  livello: 'magistrale' as const,
  aa: '2023',
  fonte: 'locale' as const,
  pubblicato: true,
});

test('accepts a minimal valid corso', () => {
  const corso = parseCorso(validCorso());
  assert.equal(corso.titolo, 'Probabilità e statistica');
  assert.equal(corso.anno, 2);
});

test('accepts a minimal valid tesi, with no anno', () => {
  const tesi = parseCorso(validTesi());
  assert.equal(tesi.tipo, 'tesi');
  assert.equal(tesi.anno, undefined);
});

test('rejects a missing titolo', () => {
  const { titolo, ...rest } = validCorso();
  assert.throws(() => parseCorso(rest), CorsoSchemaError);
});

test('rejects an unknown key', () => {
  assert.throws(
    () => parseCorso({ ...validCorso(), extra: true }),
    (error: unknown) => error instanceof CorsoSchemaError && error.issues.some((i) => i.includes('extra')),
  );
});

test('rejects a tipo outside the enum', () => {
  assert.throws(() => parseCorso({ ...validCorso(), tipo: 'lezione' }), CorsoSchemaError);
});

test('rejects a livello outside the enum', () => {
  assert.throws(() => parseCorso({ ...validCorso(), livello: 'dottorato' }), CorsoSchemaError);
});

test('rejects a fonte outside the enum', () => {
  assert.throws(() => parseCorso({ ...validCorso(), fonte: 'appunti-a-mano' }), CorsoSchemaError);
});

test('requires anno for tipo corso', () => {
  const { anno, ...rest } = validCorso();
  assert.throws(() => parseCorso(rest), CorsoSchemaError);
});

test('allows a tesi with no anno at all', () => {
  const tesi = parseCorso(validTesi());
  assert.equal(tesi.anno, undefined);
});

test('accepts anno at the top of the triennale range', () => {
  const corso = parseCorso({ ...validCorso(), livello: 'triennale', anno: 3 });
  assert.equal(corso.anno, 3);
});

test('rejects anno above the triennale range', () => {
  assert.throws(() => parseCorso({ ...validCorso(), livello: 'triennale', anno: 4 }), CorsoSchemaError);
});

test('accepts anno at the top of the magistrale range', () => {
  const corso = parseCorso({ ...validCorso(), livello: 'magistrale', anno: 2 });
  assert.equal(corso.anno, 2);
});

test('rejects anno above the magistrale range', () => {
  assert.throws(() => parseCorso({ ...validCorso(), livello: 'magistrale', anno: 3 }), CorsoSchemaError);
});

test('rejects anno below 1', () => {
  assert.throws(() => parseCorso({ ...validCorso(), anno: 0 }), CorsoSchemaError);
});

test('rejects a non-integer anno', () => {
  assert.throws(() => parseCorso({ ...validCorso(), anno: 1.5 }), CorsoSchemaError);
});

test('accepts a well-formed academic year for a corso', () => {
  const corso = parseCorso({ ...validCorso(), aa: '2021/22' });
  assert.equal(corso.aa, '2021/22');
});

test('rejects a malformed academic year for a corso', () => {
  assert.throws(() => parseCorso({ ...validCorso(), aa: '2021' }), CorsoSchemaError);
});

test('accepts a four-digit defense year for a tesi', () => {
  const tesi = parseCorso({ ...validTesi(), aa: '2022' });
  assert.equal(tesi.aa, '2022');
});

test('rejects an academic-year-shaped aa for a tesi', () => {
  assert.throws(() => parseCorso({ ...validTesi(), aa: '2021/22' }), CorsoSchemaError);
});

test('requires motivo when pubblicato is false', () => {
  assert.throws(() => parseCorso({ ...validCorso(), pubblicato: false }), CorsoSchemaError);
});

test('accepts pubblicato false with a motivo', () => {
  const corso = parseCorso({ ...validCorso(), pubblicato: false, motivo: 'da confermare con il docente' });
  assert.equal(corso.motivo, 'da confermare con il docente');
});

test('does not require motivo when pubblicato is true', () => {
  const corso = parseCorso(validCorso());
  assert.equal(corso.motivo, undefined);
});

test('accepts an optional fonti list', () => {
  const corso = parseCorso({ ...validCorso(), fonti: ['Slide del docente', 'Libro di testo'] });
  assert.deepEqual(corso.fonti, ['Slide del docente', 'Libro di testo']);
});

test('rejects a non-string entry in fonti', () => {
  assert.throws(() => parseCorso({ ...validCorso(), fonti: ['ok', 42] }), CorsoSchemaError);
});

test('error messages name the field, in Italian', () => {
  assert.throws(
    () => parseCorso({ ...validCorso(), pubblicato: false }),
    (error: unknown) => error instanceof CorsoSchemaError && error.issues.some((i) => i.includes('"motivo"')),
  );
});
