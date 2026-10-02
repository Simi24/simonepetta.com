import { el } from '../dom.ts';

export interface SheetPreview {
  element: HTMLElement;
  /** Shows the rendered post; `hasText` false adds the line that says the book appears without one. */
  show: (html: string, hasText: boolean) => void;
  hide: () => void;
}

/** The preview pane, hidden until asked for: the dev server's rendering of the real post page. */
export function buildSheetPreview(slug: string): SheetPreview {
  const element = el('div');
  const pane = el('div');
  element.append(el('p', 'muted', `Anteprima: così appare su simonepetta.com/letture/${slug}/`), pane);
  element.hidden = true;
  return {
    element,
    show: (html, hasText) => {
      pane.innerHTML = html;
      if (!hasText) pane.appendChild(el('p', 'empty', "Nessun testo: sul sito il libro compare nell'elenco con voto e date."));
      element.hidden = false;
    },
    hide: () => {
      element.hidden = true;
    },
  };
}
