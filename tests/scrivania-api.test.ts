import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { postSave } from '../src/integrations/scrivania/client/api.ts';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function stubFetch(body: unknown, status = 200): void {
  globalThis.fetch = (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
}

test('postSave carries a response warning through, instead of dropping it', async () => {
  stubFetch({ slug: 'un-libro', warning: "l'aggiornamento del contenuto è fallito" });
  const result = await postSave('/__scrivania/save', { data: {} });
  assert.deepEqual(result, { ok: true, slug: 'un-libro', warning: "l'aggiornamento del contenuto è fallito" });
});

test('postSave reports no warning when the response has none', async () => {
  stubFetch({ slug: 'un-libro' });
  const result = await postSave('/__scrivania/save', { data: {} });
  assert.deepEqual(result, { ok: true, slug: 'un-libro', warning: undefined });
});
