import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReloadGate } from '../src/integrations/scrivania/reload-gate.ts';

function fakeHot() {
  const sent: unknown[] = [];
  return { sent, hot: { send: (payload: unknown) => void sent.push(payload) } };
}
const fullReload = { type: 'full-reload', path: '*' };

test('outside a save, every message goes through untouched', () => {
  const { hot, sent } = fakeHot();
  createReloadGate(hot);
  hot.send(fullReload);
  hot.send({ type: 'update', updates: [] });
  assert.deepEqual(sent, [fullReload, { type: 'update', updates: [] }]);
});

test('during a save, a full reload is held and sent once, after the save is done', async () => {
  const { hot, sent } = fakeHot();
  const gate = createReloadGate(hot);
  await gate.during(() => {
    hot.send(fullReload);
    hot.send(fullReload);
    hot.send({ type: 'update', updates: [] });
    assert.deepEqual(sent, [{ type: 'update', updates: [] }], 'only the full reloads wait');
    return Promise.resolve();
  });
  assert.deepEqual(sent, [{ type: 'update', updates: [] }, fullReload]);
});

test('nothing is sent after a save that held no reload, and a failing save still releases the hold', async () => {
  const { hot, sent } = fakeHot();
  const gate = createReloadGate(hot);
  await gate.during(() => Promise.resolve());
  assert.deepEqual(sent, []);
  await assert.rejects(
    gate.during(() => {
      hot.send(fullReload);
      return Promise.reject(new Error('boom'));
    }),
    /boom/,
  );
  assert.deepEqual(sent, [fullReload]);
});

test('with two saves overlapping, the reload waits for the last one', async () => {
  const { hot, sent } = fakeHot();
  const gate = createReloadGate(hot);
  let finishSecond!: () => void;
  const second = gate.during(() => new Promise<void>((resolve) => (finishSecond = resolve)));
  await gate.during(() => {
    hot.send(fullReload);
    return Promise.resolve();
  });
  assert.deepEqual(sent, [], 'the second save is still running');
  finishSecond();
  await second;
  assert.deepEqual(sent, [fullReload]);
});
