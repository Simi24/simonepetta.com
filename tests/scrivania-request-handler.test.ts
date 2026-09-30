import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { createSaveHandler } from '../src/integrations/scrivania/request-handler.ts';

let server: Server;
let url: string;
let contentDir: string;
let onSavedShouldFail = false;

before(async () => {
  contentDir = mkdtempSync(join(tmpdir(), 'scrivania-handler-'));
  const handleSave = createSaveHandler({
    contentDir,
    onSaved: () => {
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
