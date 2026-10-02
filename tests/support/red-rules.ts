/** One CSS rule that references `var(--red)`: its selectors, normalized, and the file it came from. */
export interface RedRule {
  selector: string;
  source: string;
}

/** Astro scoping decorations that say nothing about what the selector targets. */
const scoping = /\[data-astro-cid-[\w-]+\]|:where\(\.astro-[\w-]+\)/g;

/** The three places red is allowed (SPEC.md §5.1): link hover, focus outline, current nav item. */
export const isAllowedRedSelector = (selector: string): boolean =>
  selector === 'a:hover' || selector === 'nav a[aria-current]' || selector.endsWith(':focus-visible');

/** Every selector of every rule in `css` whose declarations reference `var(--red)`. */
export function redRules(css: string, source: string): RedRule[] {
  const found: RedRule[] = [];
  for (const [, selectors = '', body = ''] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/var\(\s*--red\s*\)/.test(body)) continue;
    for (const part of selectors.split(',')) {
      found.push({ selector: part.replace(scoping, '').replace(/\s+/g, ' ').trim(), source });
    }
  }
  return found;
}

/** The text of every `<style>` block in an HTML document. */
export const inlineStyles = (html: string): string =>
  [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
