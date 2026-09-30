import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { saveLettura } from '../src/integrations/scrivania/save.ts';
import { fileVersion } from '../src/integrations/scrivania/version.ts';
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

test('creating a book never overwrites an existing file, even when both slug candidates are taken', () => {
  const contentDir = tempContentDir();
  saveLettura({
    contentDir,
    input: { titolo: 'Finzioni', autore: 'Jorge Luis Borges', stato: 'in-corso', iniziato: '2026-09-01' },
  });
  saveLettura({
    contentDir,
    input: { titolo: 'Finzioni', autore: 'Julio Cortázar', stato: 'in-corso', iniziato: '2026-09-02' },
  });
  const path = join(contentDir, 'finzioni-cortazar.md');
  const body = '\nIl testo che Cortázar ha scritto su Finzioni, da non perdere in un salvataggio successivo.\n';
  writeFileSync(path, readFileSync(path, 'utf8').replace(/\n$/, '') + body);

  assert.throws(
    () =>
      saveLettura({
        contentDir,
        input: { titolo: 'Finzioni', autore: 'Julio Cortázar', stato: 'in-corso', iniziato: '2026-09-03' },
      }),
    (error: unknown) => error instanceof LetturaSchemaError && error.issues.some((i) => i.includes('"titolo"')),
  );
  assert.deepEqual(readdirSync(contentDir).sort(), ['finzioni-cortazar.md', 'finzioni.md']);
  assert.ok(readFileSync(path, 'utf8').includes('Il testo che Cortázar ha scritto'));
});

test('a title with no ASCII letters or digits is rejected when creating, writing nothing', () => {
  const contentDir = tempContentDir();
  assert.throws(
    () => saveLettura({ contentDir, input: { titolo: '東京', autore: '!!!', stato: 'in-corso', iniziato: '2026-09-01' } }),
    (error: unknown) => error instanceof LetturaSchemaError && error.issues.some((i) => i.includes('"titolo"')),
  );
  assert.deepEqual(readdirSync(contentDir), []);
});

test('an invalid payload is rejected with a per-field message and writes no file', () => {
  const contentDir = tempContentDir();
  assert.throws(
    () => saveLettura({ contentDir, input: { titolo: 'Senza autore', stato: 'in-corso' } }),
    (error: unknown) => error instanceof LetturaSchemaError && error.issues.some((i) => i.includes('"autore"')),
  );
  assert.deepEqual(readdirSync(contentDir), []);
});

test('editing a CRLF file (accepted by the loader) is read correctly, preserving the body', () => {
  const contentDir = tempContentDir();
  const path = join(contentDir, 'il-nome-della-rosa.md');
  writeFileSync(path, '---\r\ntitolo: "Il nome della rosa"\r\nautore: "Umberto Eco"\r\nstato: in-corso\r\n---\r\n\r\nTESTO CRLF\r\n');

  saveLettura({
    contentDir,
    slug: 'il-nome-della-rosa',
    input: { titolo: 'Il nome della rosa', autore: 'Umberto Eco', stato: 'in-corso', iniziato: '2026-09-14' },
  });

  assert.ok(readFileSync(path, 'utf8').includes('TESTO CRLF'));
});

test('editing a file with a BOM (accepted by the loader) is read correctly, preserving the body', () => {
  const contentDir = tempContentDir();
  const path = join(contentDir, 'il-nome-della-rosa.md');
  writeFileSync(
    path,
    '﻿---\ntitolo: "Il nome della rosa"\nautore: "Umberto Eco"\nstato: in-corso\n---\n\nTESTO CON BOM\n',
  );

  saveLettura({
    contentDir,
    slug: 'il-nome-della-rosa',
    input: { titolo: 'Il nome della rosa', autore: 'Umberto Eco', stato: 'in-corso', iniziato: '2026-09-14' },
  });

  assert.ok(readFileSync(path, 'utf8').includes('TESTO CON BOM'));
});

test('editing a file with a trailing space on the closing fence fails loudly and writes nothing', () => {
  const contentDir = tempContentDir();
  const path = join(contentDir, 'il-nome-della-rosa.md');
  const original = '---\ntitolo: "Il nome della rosa"\nautore: "Umberto Eco"\nstato: in-corso\n--- \n\nTESTO\n';
  writeFileSync(path, original);

  assert.throws(
    () =>
      saveLettura({
        contentDir,
        slug: 'il-nome-della-rosa',
        input: { titolo: 'Il nome della rosa', autore: 'Umberto Eco', stato: 'in-corso', iniziato: '2026-09-14' },
      }),
    LetturaSchemaError,
  );
  assert.equal(readFileSync(path, 'utf8'), original);
});

test('editing with a slug that would escape the content directory is rejected, writing nothing', () => {
  const contentDir = tempContentDir();
  assert.throws(
    () =>
      saveLettura({
        contentDir,
        slug: '../escaped',
        input: { titolo: 'Titolo', autore: 'Autore', stato: 'in-corso', iniziato: '2026-09-14' },
      }),
    LetturaSchemaError,
  );
  assert.deepEqual(readdirSync(contentDir), []);
});

test('editing with a slug that is not kebab-case is rejected, writing nothing', () => {
  const contentDir = tempContentDir();
  assert.throws(
    () =>
      saveLettura({
        contentDir,
        slug: 'Il_Nome',
        input: { titolo: 'Titolo', autore: 'Autore', stato: 'in-corso', iniziato: '2026-09-14' },
      }),
    LetturaSchemaError,
  );
  assert.deepEqual(readdirSync(contentDir), []);
});

test('editing with a slug that does not correspond to an existing file is rejected', () => {
  const contentDir = tempContentDir();
  assert.throws(
    () =>
      saveLettura({
        contentDir,
        slug: 'non-esiste',
        input: { titolo: 'Titolo', autore: 'Autore', stato: 'in-corso', iniziato: '2026-09-14' },
      }),
    LetturaSchemaError,
  );
  assert.deepEqual(readdirSync(contentDir), []);
});

test('frontmatter strings are JSON-quoted, so a backslash or a quote never breaks the YAML', () => {
  const contentDir = tempContentDir();
  saveLettura({
    contentDir,
    input: { titolo: 'A\\qB "citata"', autore: 'Autore', stato: 'in-corso', iniziato: '2026-09-14' },
  });
  const written = readFileSync(join(contentDir, 'a-qb-citata.md'), 'utf8');
  assert.ok(written.includes(`titolo: ${JSON.stringify('A\\qB "citata"')}`));
});

test('the body is preserved exactly on edit: no trimming of its leading or trailing whitespace', () => {
  const contentDir = tempContentDir();
  const path = join(contentDir, 'il-nome-della-rosa.md');
  const original = '---\ntitolo: "Il nome della rosa"\nautore: "Umberto Eco"\nstato: in-corso\n---\n   \nTESTO CON SPAZI   \n\n\n';
  writeFileSync(path, original);
  const originalBody = original.replace(/^[\s\S]*?\n---\n/, '');

  saveLettura({
    contentDir,
    slug: 'il-nome-della-rosa',
    input: { titolo: 'Il nome della rosa', autore: 'Umberto Eco', stato: 'in-corso', iniziato: '2026-09-15' },
  });

  const written = readFileSync(path, 'utf8');
  assert.ok(written.endsWith(originalBody), `body was altered:\n${JSON.stringify(written)}`);
});

test('the writing sheet writes the given testo as the new body, trimmed, on edit', () => {
  const contentDir = tempContentDir();
  saveLettura({
    contentDir,
    input: { titolo: 'Il nome della rosa', autore: 'Umberto Eco', stato: 'letto', finito: '2026-09-25' },
  });

  saveLettura({
    contentDir,
    slug: 'il-nome-della-rosa',
    input: { titolo: 'Il nome della rosa', autore: 'Umberto Eco', stato: 'letto', finito: '2026-09-25', voto: 4 },
    testo: '  \n## A cosa si collega\n\nUna reazione sincera.  \n\n\n',
  });

  const written = readFileSync(join(contentDir, 'il-nome-della-rosa.md'), 'utf8');
  assert.match(written, /---\n\n## A cosa si collega\n\nUna reazione sincera\.\n$/);
});

test('a testo of only whitespace writes an empty body, same as a brand new file', () => {
  const contentDir = tempContentDir();
  saveLettura({
    contentDir,
    input: { titolo: 'Il nome della rosa', autore: 'Umberto Eco', stato: 'letto', finito: '2026-09-25' },
  });

  saveLettura({
    contentDir,
    slug: 'il-nome-della-rosa',
    input: { titolo: 'Il nome della rosa', autore: 'Umberto Eco', stato: 'letto', finito: '2026-09-25' },
    testo: '   \n',
  });

  const written = readFileSync(join(contentDir, 'il-nome-della-rosa.md'), 'utf8');
  assert.match(written, /---\n$/);
  assert.equal((written.match(/---/g) ?? []).length, 2);
});

test('omitting testo on an edit still preserves the existing body exactly, even when the old frontmatter would be unreadable', () => {
  const contentDir = tempContentDir();
  const path = join(contentDir, 'il-nome-della-rosa.md');
  // A malformed old frontmatter would normally fail loudly on a metadata-only edit (see the
  // "unreadable" tests above); it must not block a save that replaces the body wholesale.
  writeFileSync(path, '---\ntitolo: "Il nome della rosa"\nautore: "Umberto Eco"\nstato: in-corso\n--- \n\nTESTO\n');

  saveLettura({
    contentDir,
    slug: 'il-nome-della-rosa',
    input: { titolo: 'Il nome della rosa', autore: 'Umberto Eco', stato: 'letto', finito: '2026-09-25' },
    testo: 'Testo nuovo di zecca.',
  });

  const written = readFileSync(path, 'utf8');
  assert.ok(written.endsWith('Testo nuovo di zecca.\n'));
});

test('a sheet save whose expectedVersion no longer matches the file is rejected as a conflict, writing nothing', () => {
  const contentDir = tempContentDir();
  saveLettura({
    contentDir,
    input: { titolo: 'Con Conflitto', autore: 'Autore', stato: 'letto', finito: '2026-09-20' },
  });
  const path = join(contentDir, 'con-conflitto.md');
  const staleVersion = fileVersion(readFileSync(path));

  // Someone (or something) else changes the file after the sheet's page was generated: a second
  // `/scrivi` tab, a hand edit, or a failed-then-retried save.
  writeFileSync(path, readFileSync(path, 'utf8') + '\nModifica esterna nel frattempo.\n');

  assert.throws(
    () =>
      saveLettura({
        contentDir,
        slug: 'con-conflitto',
        input: { titolo: 'Con Conflitto', autore: 'Autore', stato: 'letto', finito: '2026-09-20' },
        testo: 'Testo scritto dalla scrivania, che non deve arrivare sul disco.',
        expectedVersion: staleVersion,
      }),
    (error: unknown) => error instanceof LetturaSchemaError && error.issues.some((i) => i.includes('cambiato')),
  );

  const stillOnDisk = readFileSync(path, 'utf8');
  assert.ok(stillOnDisk.includes('Modifica esterna nel frattempo.'));
  assert.ok(!stillOnDisk.includes('Testo scritto dalla scrivania'));
});

test('a sheet save whose expectedVersion still matches the file proceeds normally', () => {
  const contentDir = tempContentDir();
  saveLettura({
    contentDir,
    input: { titolo: 'Senza Conflitto', autore: 'Autore', stato: 'letto', finito: '2026-09-20' },
  });
  const path = join(contentDir, 'senza-conflitto.md');
  const version = fileVersion(readFileSync(path));

  saveLettura({
    contentDir,
    slug: 'senza-conflitto',
    input: { titolo: 'Senza Conflitto', autore: 'Autore', stato: 'letto', finito: '2026-09-20' },
    testo: 'Testo scritto dalla scrivania.',
    expectedVersion: version,
  });

  assert.ok(readFileSync(path, 'utf8').includes('Testo scritto dalla scrivania.'));
});

test('a metadata-only edit (no testo) is never blocked by expectedVersion: it does not touch the body a conflict would protect', () => {
  const contentDir = tempContentDir();
  saveLettura({
    contentDir,
    input: { titolo: 'Solo Metadati', autore: 'Autore', stato: 'letto', finito: '2026-09-20' },
  });
  const path = join(contentDir, 'solo-metadati.md');

  // A stale (or entirely made-up) version must not matter here: no `testo` means no body write.
  saveLettura({
    contentDir,
    slug: 'solo-metadati',
    input: { titolo: 'Solo Metadati (corretto)', autore: 'Autore', stato: 'letto', finito: '2026-09-20' },
    expectedVersion: 'chiaramente-non-un-hash-valido',
  });

  assert.match(readFileSync(path, 'utf8'), /titolo: "Solo Metadati \(corretto\)"/);
});
