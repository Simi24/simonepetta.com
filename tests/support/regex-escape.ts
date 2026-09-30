/** Escapes a string for safe embedding in a `RegExp` (e.g. a URL used in a build-output match). */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
