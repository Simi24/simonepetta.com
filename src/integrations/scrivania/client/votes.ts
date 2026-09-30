import { formatVoto } from '../../../lib/lettura-format-it.ts';
import { el } from './dom.ts';

/** The clickable half-point grade picker (SPEC.md §6.4): clicking the selected value clears it. */
export function renderVotes(container: HTMLElement, selected: number | null, onChange: (voto: number | null) => void): void {
  container.textContent = '';
  for (let value = 1; value <= 5; value += 0.5) {
    const isHalf = value % 1 !== 0;
    const button = el('button', isHalf ? 'half' : '', isHalf ? '½' : String(value));
    button.type = 'button';
    button.setAttribute('aria-label', `Voto ${formatVoto(value)}`);
    button.setAttribute('aria-pressed', String(selected === value));
    button.addEventListener('click', () => onChange(selected === value ? null : value));
    container.appendChild(button);
  }
}

/** Mounts the picker into `container` (already placed in the DOM); returns a getter for the current value. */
export function mountVotes(container: HTMLElement, initial: number | null): () => number | null {
  let voto = initial;
  const update = (value: number | null): void => {
    voto = value;
    renderVotes(container, voto, update);
  };
  renderVotes(container, voto, update);
  return () => voto;
}

/** Appends a labeled `.field span4` grade picker to `form`; returns a getter for the current value. */
export function addVotesField(form: HTMLElement, initial: number | null): () => number | null {
  const wrap = el('div', 'field span4');
  wrap.appendChild(el('label', undefined, 'Voto'));
  const box = el('div', 'votes');
  wrap.appendChild(box);
  form.appendChild(wrap);
  return mountVotes(box, initial);
}
