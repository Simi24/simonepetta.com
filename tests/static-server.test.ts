import assert from 'node:assert/strict';
import { connect } from 'node:net';
import { test } from 'node:test';
import { serveStatic } from './support/static-server.ts';

// A browser can leave a connection holding half a request (an aborted fetch, a navigation in
// flight). `http.Server#close()` waits for it for as long as Node's request timeout (minutes),
// and every browser test closes its server inside the test's own 30 s budget.
test('closing the server does not wait for a connection that holds a half-sent request', async () => {
  const server = await serveStatic('tests/fixtures/beacon-page');
  const socket = connect(Number(new URL(server.url).port), '127.0.0.1');
  await new Promise<void>((resolve) => socket.once('connect', resolve));
  socket.write('GET / HTTP/1.1\r\nHost: localhost\r\n');
  socket.on('error', () => undefined);

  let timer: NodeJS.Timeout | undefined;
  const outcome = await Promise.race([
    server.close().then(() => 'closed'),
    new Promise<string>((resolve) => {
      timer = setTimeout(() => resolve('still open'), 2000);
    }),
  ]);
  clearTimeout(timer);
  socket.destroy();

  assert.equal(outcome, 'closed');
});
