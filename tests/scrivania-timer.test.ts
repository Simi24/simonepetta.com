import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { createWritingTimer, formatClock } from '../src/integrations/scrivania/client/timer.ts';

test('formats the clock as mm:ss, zero-padded', () => {
  assert.equal(formatClock(20 * 60), '20:00');
  assert.equal(formatClock(59), '00:59');
  assert.equal(formatClock(0), '00:00');
});

test('ticks down once a second and reports the remaining seconds', () => {
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    const ticks: number[] = [];
    const timer = createWritingTimer(
      (left) => ticks.push(left),
      () => {},
    );
    timer.start();
    mock.timers.tick(1000);
    mock.timers.tick(1000);
    mock.timers.tick(1000);
    assert.deepEqual(ticks, [20 * 60 - 1, 20 * 60 - 2, 20 * 60 - 3]);
  } finally {
    mock.timers.reset();
  }
});

test('calls onDone exactly once, at zero, and stops ticking after', () => {
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    let done = 0;
    const ticks: number[] = [];
    const timer = createWritingTimer(
      (left) => ticks.push(left),
      () => {
        done += 1;
      },
    );
    timer.start();
    mock.timers.tick(20 * 60 * 1000);
    assert.equal(done, 1);
    assert.equal(ticks.at(-1), 0);
    mock.timers.tick(5000);
    assert.equal(done, 1, 'onDone must fire only once');
    assert.equal(ticks.length, 20 * 60, 'no more ticks after it reaches zero');
  } finally {
    mock.timers.reset();
  }
});

test('stop() silences the timer without ever calling onDone', () => {
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    let done = 0;
    const timer = createWritingTimer(
      () => {},
      () => {
        done += 1;
      },
    );
    timer.start();
    mock.timers.tick(5000);
    timer.stop();
    mock.timers.tick(20 * 60 * 1000);
    assert.equal(done, 0);
  } finally {
    mock.timers.reset();
  }
});

test('starting twice does not run two intervals at once', () => {
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    const ticks: number[] = [];
    const timer = createWritingTimer(
      (left) => ticks.push(left),
      () => {},
    );
    timer.start();
    timer.start();
    mock.timers.tick(1000);
    assert.deepEqual(ticks, [20 * 60 - 1]);
  } finally {
    mock.timers.reset();
  }
});
