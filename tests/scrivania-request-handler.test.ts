import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { createSaveHandler } from '../src/integrations/scrivania/request-handler.ts';
import { makeTempDir } from './support/temp-root.ts';

let server: Server;
let url: string;
let contentDir: string;
let onSavedShouldFail = false;
let lastSaved: unknown;

before(async () => {
  contentDir = makeTempDir('scrivania-handler-');
  const handleSave = createSaveHandler({
    contentDir,
    onSaved: (saved) => {
      lastSaved = saved;
      if (onSavedShouldFail) throw new Error('refresh finto non riuscito');
    },
  });
  server = createServer((req, res) => {
    void handleSave(req, res, () => {
      res.statusCode = 404;
      res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (typeof address !== 'object' || address === null) throw new Error('no server address');
  url = `http://127.0.0.1:${address.port}`;
});

after(() => new Promise<void>((resolve) => server.close(() => resolve())));

function post(body: unknown): Promise<Response> {
  return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

test('a successful save with a failing content refresh reports success with a warning, not an error', async () => {
  onSavedShouldFail = true;
  const res = await post({ data: { titolo: 'Refresh Fallito', autore: 'Autore', stato: 'in-corso', iniziato: '2026-09-14' } });
  const json = (await res.json()) as { slug?: string; warning?: string };
  assert.equal(res.status, 200);
  assert.equal(json.slug, 'refresh-fallito');
  assert.match(json.warning ?? '', /refresh finto non riuscito/);
  assert.ok(readdirSync(contentDir).includes('refresh-fallito.md'));
  onSavedShouldFail = false;
});

test('a valid save with a working content refresh reports success with no warning', async () => {
  const res = await post({ data: { titolo: 'Tutto Bene', autore: 'Autore', stato: 'in-corso', iniziato: '2026-09-14' } });
  const json = (await res.json()) as { slug?: string; warning?: string };
  assert.equal(res.status, 200);
  assert.equal(json.slug, 'tutto-bene');
  assert.equal(json.warning, undefined);
});

test('an invalid payload still responds 400 and writes nothing', async () => {
  const before_ = readdirSync(contentDir).length;
  const res = await post({ data: { titolo: 'Senza autore', stato: 'in-corso' } });
  assert.equal(res.status, 400);
  assert.equal(readdirSync(contentDir).length, before_);
});

test('a save with testo writes it as the book’s body', async () => {
  await post({ data: { titolo: 'Con Testo', autore: 'Autore', stato: 'in-corso', iniziato: '2026-09-14' } });
  const res = await post({
    slug: 'con-testo',
    data: { titolo: 'Con Testo', autore: 'Autore', stato: 'letto', finito: '2026-09-20' },
    testo: 'La mia reazione al libro.',
  });
  const json = (await res.json()) as { slug?: string };
  assert.equal(res.status, 200);
  assert.equal(json.slug, 'con-testo');
  const written = readFileSync(join(contentDir, 'con-testo.md'), 'utf8');
  assert.ok(written.includes('La mia reazione al libro.'), `body missing from the written file:\n${written}`);
});

test('the refresh hook is told what was saved, so it can wait until that is served', async () => {
  const data = { titolo: 'Da Servire', autore: 'Autore', stato: 'letto', finito: '2026-09-14' };
  const created = (await (await post({ data })).json()) as { slug: string };
  await post({ slug: created.slug, data, testo: '  Il testo da servire.  ' });
  assert.deepEqual(lastSaved, { slug: 'da-servire', titolo: 'Da Servire', stato: 'letto', testo: '  Il testo da servire.  ' });
});

test('a save naming the entry’s hand-made file edits that file and answers with the entry’s slug', async () => {
  writeFileSync(join(contentDir, 'Fatto A Mano.md'), '---\ntitolo: "Fatto A Mano"\nautore: "Autore"\nstato: letto\nfinito: "2026-09-25"\n---\n');
  const res = await post({
    slug: 'fatto-a-mano',
    file: 'Fatto A Mano.md',
    data: { titolo: 'Fatto A Mano', autore: 'Autore', stato: 'letto', finito: '2026-09-26' },
  });
  assert.equal(res.status, 200);
  assert.equal(((await res.json()) as { slug: string }).slug, 'fatto-a-mano');
  assert.ok(!readdirSync(contentDir).includes('fatto-a-mano.md'));
  assert.match(readFileSync(join(contentDir, 'Fatto A Mano.md'), 'utf8'), /finito: "2026-09-26"/);
});

test('a save naming a file outside the content directory is refused, writing nothing', async () => {
  const before = readdirSync(contentDir).sort();
  const res = await post({
    slug: 'fatto-a-mano',
    file: '../fuori.md',
    data: { titolo: 'Fatto A Mano', autore: 'Autore', stato: 'letto', finito: '2026-09-26' },
  });
  assert.equal(res.status, 400);
  assert.deepEqual(readdirSync(contentDir).sort(), before);
});

test('asking for the last save answers with the file as written', async () => {
  await post({ saveId: 'id-1', data: { titolo: 'Ultimo Salvato', autore: 'Autore', stato: 'in-corso', iniziato: '2026-09-14' } });
  const res = await fetch(url);
  assert.equal(res.status, 200);
  const last = (await res.json()) as { slug: string; path: string; contents: string; saveId: string };
  assert.equal(last.slug, 'ultimo-salvato');
  assert.equal(last.saveId, 'id-1');
  assert.match(last.path, /ultimo-salvato\.md$/);
  assert.equal(last.contents, readFileSync(join(contentDir, 'ultimo-salvato.md'), 'utf8'));
});
