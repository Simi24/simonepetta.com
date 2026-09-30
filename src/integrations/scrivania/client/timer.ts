import { TIMER_SECONDS } from '../constants.ts';

export interface WritingTimer {
  /** Starts the countdown; a second call while already running is a no-op. */
  start(): void;
  /** Stops the countdown without firing `onDone` (SPEC.md §6.4: it never locks, so stopping is silent). */
  stop(): void;
}

/** The 20-minute writing timer (SPEC.md §6.4): ticks every second, calls `onDone` once at zero, never locks anything itself. */
export function createWritingTimer(onTick: (secondsLeft: number) => void, onDone: () => void): WritingTimer {
  let remaining = TIMER_SECONDS;
  let handle: ReturnType<typeof setInterval> | undefined;
  return {
    start() {
      if (handle !== undefined) return;
      handle = setInterval(() => {
        remaining = Math.max(0, remaining - 1);
        onTick(remaining);
        if (remaining === 0) {
          clearInterval(handle);
          handle = undefined;
          onDone();
        }
      }, 1000);
    },
    stop() {
      if (handle !== undefined) clearInterval(handle);
      handle = undefined;
    },
  };
}

/** `1200` → `"20:00"`. */
export function formatClock(secondsLeft: number): string {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
