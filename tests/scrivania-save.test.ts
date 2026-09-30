import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { saveLettura } from '../src/integrations/scrivania/save.ts';
import { LetturaSchemaError } from '../src/schemas/lettura.ts';

function tempContentDir(): string {
  return mkdtempSync(join(tmpdir(), 'scrivania-save-'));
}

test('writes a new book to a slugified file name, with quoted ISO dates', () => {
  const contentDir = tempContentDir();
  const result = saveLettura({
    contentDir,
    input: { titolo: 'Il nome della rosa', autore: 'Umberto Eco', stato: 'in-corso', iniziato: '2026-09-14' },
  });
  assert.equal(result.slug, 'il-nome-della-rosa');
  const written = readFileSync(join(contentDir, 'il-nome-della-rosa.md'), 'utf8');
  assert.match(written, /^---\ntitolo: "Il nome della rosa"\nautore: "Umberto Eco"\nstato: in-corso\niniziato: "2026-09-14"\n---\n$/);
});

test('a slug collision appends the author’s surname', () => {
  const contentDir = tempContentDir();
  saveLettura({
    contentDir,
    input: { titolo: 'Finzioni', autore: 'Jorge Luis Borges', stato: 'in-corso', iniziato: '2026-09-01' },
  });
  const result = saveLettura({
    contentDir,
    input: { titolo: 'Finzioni', autore: 'Julio Cortázar', stato: 'in-corso', iniziato: '2026-09-02' },
  });
  assert.equal(result.slug, 'finzioni-cortazar');
  assert.deepEqual(readdirSync(contentDir).sort(), ['finzioni-cortazar.md', 'finzioni.md']);
});

test('editing metadata keeps the file name even when the title changes, and never touches the body', () => {
  const contentDir = tempContentDir();
  saveLettura({
    contentDir,
    input: { titolo: 'Il nome della rosa', autore: 'Umberto Eco', stato: 'letto', finito: '2026-09-25' },
  });
  const path = join(contentDir, 'il-nome-della-rosa.md');
  const body = '\nLa prosa dell’autore, mai toccata da un salvataggio di sola metadata.\n';
  writeFileSync(path, readFileSync(path, 'utf8').replace(/\n$/, '') + body);

  const result = saveLettura({
    contentDir,
    slug: 'il-nome-della-rosa',
    input: { titolo: 'Il nome della Rosa (edizione riveduta)', autore: 'Umberto Eco', stato: 'letto', finito: '2026-09-26' },
  });

  assert.equal(result.slug, 'il-nome-della-rosa');
  assert.deepEqual(readdirSync(contentDir), ['il-nome-della-rosa.md']);
  const written = readFileSync(path, 'utf8');
  assert.match(written, /titolo: "Il nome della Rosa \(edizione riveduta\)"/);
  assert.match(written, /finito: "2026-09-26"/);
  assert.ok(written.includes('La prosa dell’autore, mai toccata da un salvataggio di sola metadata.'));
});

test('an invalid payload is rejected with a per-field message and writes no file', () => {
  const contentDir = tempContentDir();
  assert.throws(
    () => saveLettura({ contentDir, input: { titolo: 'Senza autore', stato: 'in-corso' } }),
    (error: unknown) => error instanceof LetturaSchemaError && error.issues.some((i) => i.includes('"autore"')),
  );
  assert.deepEqual(readdirSync(contentDir), []);
});
