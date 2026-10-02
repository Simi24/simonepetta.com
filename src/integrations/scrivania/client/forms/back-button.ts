import { el } from '../dom.ts';

/** The quiet "Indietro" every sub-form opens with. */
export function backButton(onClick: () => void): HTMLButtonElement {
  const button = el('button', 'btn quiet', 'Indietro');
  button.type = 'button';
  button.addEventListener('click', onClick);
  return button;
}
