import { OUTLINE_PROMPTS, TIMER_SECONDS } from '../../constants.ts';
import { el } from '../dom.ts';
import { insertOutlineHeading } from '../outline.ts';
import { createWritingTimer, formatClock } from '../timer.ts';

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export interface SheetDesk {
  element: HTMLElement;
  textarea: HTMLTextAreaElement;
  /** Stops the timer. */
  stop: () => void;
}

/**
 * The paper and its side panel: the clock, the word counter and the outline. The timer starts at
 * the first keystroke and only on a fresh text, never on an edit of one that already exists
 * (SPEC.md §6.4).
 */
export function buildSheetDesk(initialTesto: string, isEditingText: boolean): SheetDesk {
  const desk = el('div', 'desk');
  const paper = el('div', 'paper');
  const textarea = document.createElement('textarea');
  textarea.id = 'dk-text';
  textarea.setAttribute('aria-label', 'La tua reazione');
  textarea.placeholder = 'Scrivi come se nessuno leggesse. Una passata, poi salvi.';
  textarea.value = initialTesto;
  paper.appendChild(textarea);

  const side = el('aside', 'side');
  const clockWrap = el('div');
  clockWrap.hidden = isEditingText;
  const clockEl = el('div', 'clock', formatClock(TIMER_SECONDS));
  const clockNote = el('div', 'clock-note', 'Parte quando inizi a scrivere.');
  clockWrap.append(clockEl, clockNote);

  const wordsWrap = el('div', 'words');
  const wordsCount = el('b', undefined, String(countWords(initialTesto)));
  wordsWrap.append(wordsCount, document.createTextNode(' '), el('span', 'muted', 'parole, intorno a 250'));

  const promptsBox = el('div');
  promptsBox.appendChild(el('h2', undefined, 'Se ti serve una traccia'));
  const promptsList = el('ol', 'prompts');
  for (const prompt of OUTLINE_PROMPTS) {
    const li = el('li');
    const button = el('button', undefined, prompt);
    button.type = 'button';
    button.addEventListener('click', () => {
      textarea.value = insertOutlineHeading(textarea.value, prompt);
      textarea.focus();
      textarea.dispatchEvent(new Event('input'));
    });
    li.appendChild(button);
    promptsList.appendChild(li);
  }
  promptsBox.appendChild(promptsList);
  promptsBox.appendChild(el('p', 'muted', 'Clic per usarla come titolo. Non sei obbligato.'));
  side.append(clockWrap, wordsWrap, promptsBox);
  desk.append(paper, side);

  let started = false;
  const timer = createWritingTimer(
    (secondsLeft) => {
      clockEl.textContent = formatClock(secondsLeft);
    },
    () => {
      clockNote.textContent = 'Venti minuti. Se hai detto quello che volevi, salva così com’è.';
    },
  );
  textarea.addEventListener('input', () => {
    wordsCount.textContent = String(countWords(textarea.value));
    if (!isEditingText && !started) {
      started = true;
      clockNote.textContent = 'Una passata sola, senza tornare indietro.';
      timer.start();
    }
  });

  return { element: desk, textarea, stop: () => timer.stop() };
}
