/** The part of Vite's client channel the gate needs. */
export interface HotChannel {
  send: (payload: unknown) => void;
}

function isFullReload(payload: unknown): boolean {
  return typeof payload === 'object' && payload !== null && (payload as { type?: unknown }).type === 'full-reload';
}

/**
 * Astro's dev server tells every open page to reload each time the content store is written, which
 * a save does inside `refreshContent`, before `/scrivi/` serves the new content. A page reloaded
 * then can land on the previous shelf. While a save runs, the gate holds those reloads and sends
 * one when it is done, so every page, the saving tab included, reloads onto what was saved.
 */
export function createReloadGate(hot: HotChannel) {
  const send = hot.send.bind(hot);
  let saving = 0;
  let held = false;
  hot.send = (payload) => {
    if (saving > 0 && isFullReload(payload)) {
      held = true;
      return;
    }
    send(payload);
  };
  return {
    async during<T>(save: () => Promise<T>): Promise<T> {
      saving++;
      try {
        return await save();
      } finally {
        saving--;
        if (saving === 0 && held) {
          held = false;
          send({ type: 'full-reload', path: '*' });
        }
      }
    },
  };
}
