import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { after, before, test } from 'node:test';
import { createPreviewHandler, type PreviewHandlerOptions } from '../src/integrations/scrivania/preview.ts';

let server: Server;
let url: string;

// The handler only reaches for the markdown renderer and the module loader: these stand in for
// the two, so the failure paths can be driven without a dev server.
const markdown = {
  processor: { createRenderer: () => Promise.resolve({ render: (text: string) => Promise.resolve({ code: `<p>${text}</p>` }) }) },
} as unknown as PreviewHandlerOptions['markdown'];
const failingServer = {
  ssrLoadModule: () => Promise.reject(new Error('Post non caricabile')),
} as unknown as PreviewHandlerOptions['server'];

before(async () => {
  const handlePreview = createPreviewHandler({
    server: failingServer,
    markdown,
    image: {} as PreviewHandlerOptions['image'],
    postEntrypoint: '/Post.astro',
  });
  server = createServer((req, res) => {
    void handlePreview(req, res, () => {
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

test('a draft whose data does not pass the schema is answered with per-field issues, not rendered', async () => {
  const res = await post({ data: { titolo: 'Senza autore', stato: 'letto' }, testo: 'Un testo.' });
  const json = (await res.json()) as { issues?: string[] };
  assert.equal(res.status, 400);
  assert.ok((json.issues ?? []).some((issue) => issue.includes('autore')));
});

test('a failure while rendering is answered with a 500 and its message', async () => {
  const res = await post({ data: { titolo: 'Titolo', autore: 'Autore', stato: 'letto', finito: '2026-09-25' }, testo: 'Un testo.' });
  const json = (await res.json()) as { issues?: string[] };
  assert.equal(res.status, 500);
  assert.deepEqual(json.issues, ['Post non caricabile']);
});
