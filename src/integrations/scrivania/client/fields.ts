import { el } from './dom.ts';

export interface FieldOptions {
  span?: 2 | 4;
  type?: 'text' | 'date';
  required?: boolean;
  placeholder?: string;
  numeric?: boolean;
}

/** One `.field` (label + input), appended to `form`, following the contract's form grid. */
export function addField(form: HTMLElement, labelText: string, id: string, value: string, opts: FieldOptions = {}): HTMLInputElement {
  const wrap = el('div', ['field', opts.span ? `span${opts.span}` : ''].filter(Boolean).join(' '));
  const label = el('label', undefined, labelText);
  label.htmlFor = id;
  const input = document.createElement('input');
  input.id = id;
  input.name = id;
  input.type = opts.type ?? 'text';
  if (opts.numeric) input.inputMode = 'numeric';
  if (opts.required) input.required = true;
  if (opts.placeholder) input.placeholder = opts.placeholder;
  input.value = value;
  wrap.append(label, input);
  form.appendChild(wrap);
  return input;
}

/** The submit button, in its own full-width grid row. */
export function addSubmit(form: HTMLElement, label: string): void {
  const wrap = el('div', 'span4');
  const button = el('button', 'btn solid', label);
  button.type = 'submit';
  wrap.appendChild(button);
  form.appendChild(wrap);
}

/** Replaces `box`'s contents with one `<p class="error">` per issue. */
export function showErrors(box: HTMLElement, issues: readonly string[]): void {
  box.textContent = '';
  for (const issue of issues) box.appendChild(el('p', 'error', issue));
}
