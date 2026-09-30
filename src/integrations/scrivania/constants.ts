/** The dev-server save endpoint (SPEC.md §6.4). Shared by the middleware and the page's client script. */
export const SAVE_PATH = '/__scrivania/save';

/** The dev-server preview endpoint (SPEC.md §6.4): renders the sheet's current draft with the real `Post` component. */
export const PREVIEW_PATH = '/__scrivania/anteprima';

/** The 20-minute writing timer (SPEC.md §6.4). */
export const TIMER_SECONDS = 20 * 60;

/** The four format questions from the prototype (SPEC.md §6.4): optional, click inserts as a `##` heading. */
export const OUTLINE_PROMPTS = [
  'Cosa ci ho trovato che non mi aspettavo',
  'A cosa si collega',
  'Cosa non ha funzionato',
  'Voto, e a chi lo darei',
] as const;
