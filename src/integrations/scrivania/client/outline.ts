/**
 * Appends `prompt` as a `##` heading (SPEC.md §6.4): separated from whatever came before by a
 * blank line, never doubling one up when the text already ends with one.
 */
export function insertOutlineHeading(text: string, prompt: string): string {
  if (text === '') return `## ${prompt}\n\n`;
  const separator = text.endsWith('\n\n') ? '' : text.endsWith('\n') ? '\n' : '\n\n';
  return `${text}${separator}## ${prompt}\n\n`;
}
