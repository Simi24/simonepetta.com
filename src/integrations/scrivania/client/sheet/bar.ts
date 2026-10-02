import { el } from '../dom.ts';

export interface SheetBar {
  element: HTMLElement;
  /** Swaps "Anteprima" for "Torna a scrivere" and back. */
  setPreviewing: (previewing: boolean) => void;
  onBack: (handler: () => void) => void;
  onPreview: (handler: () => void) => void;
  onEdit: (handler: () => void) => void;
  onSave: (handler: () => void) => void;
  /** Disables "Salva" while a save is in flight. */
  setSaving: (saving: boolean) => void;
}

function button(label: string, cls: string): HTMLButtonElement {
  const node = el('button', cls, label);
  node.type = 'button';
  return node;
}

/** The fixed bottom bar (docs/prototype/scrivania.html): a hint for this kind of sheet, then the actions. */
export function buildSheetBar(note: string): SheetBar {
  const bar = el('div', 'bar');
  const inner = el('div', 'bar-in');
  const back = button('Mensola', 'btn quiet');
  const preview = button('Anteprima', 'btn');
  const edit = button('Torna a scrivere', 'btn');
  edit.hidden = true;
  const save = button('Salva', 'btn solid');
  inner.append(el('span', 'grow', note), back, preview, edit, save);
  bar.appendChild(inner);
  return {
    element: bar,
    setPreviewing: (previewing) => {
      preview.hidden = previewing;
      edit.hidden = !previewing;
    },
    onBack: (handler) => back.addEventListener('click', handler),
    onPreview: (handler) => preview.addEventListener('click', handler),
    onEdit: (handler) => edit.addEventListener('click', handler),
    onSave: (handler) => save.addEventListener('click', handler),
    setSaving: (saving) => {
      save.disabled = saving;
    },
  };
}
