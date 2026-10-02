import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildSite, filesWithExtension, read } from './support/built-site.ts';
import { inlineStyles, isAllowedRedSelector, redRules } from './support/red-rules.ts';

const SRC = new URL('../src/', import.meta.url).pathname;

const builtRules = () => {
  const dist = buildSite();
  return [
    ...filesWithExtension(dist, '.css').flatMap((file) => redRules(read(dist, file), file)),
    ...filesWithExtension(dist, '.html').flatMap((file) => redRules(inlineStyles(read(dist, file)), file)),
  ];
};

test('the rule scanner flags a selector outside the three allowed uses', () => {
  const css = `a:hover{text-decoration-color:var(--red)} .rule{border-top:2px solid var(--red)} .x:focus-visible,.y{outline-color:var(--red)}`;
  const rejected = redRules(css, 'fixture.css')
    .filter((rule) => !isAllowedRedSelector(rule.selector))
    .map((rule) => rule.selector);
  assert.deepEqual(rejected, ['.rule', '.y']);
});

test('in the built CSS, --red is used only by link hover, focus outline and the current nav item', () => {
  const rules = builtRules();
  const rejected = rules.filter((rule) => !isAllowedRedSelector(rule.selector));
  assert.deepEqual(rejected, []);
  // The scan must have seen all three uses, or it would pass by checking nothing.
  const selectors = rules.map((rule) => rule.selector);
  assert.ok(selectors.includes('a:hover'), 'no link hover rule uses --red');
  assert.ok(selectors.includes(':focus-visible'), 'no focus outline rule uses --red');
  assert.ok(selectors.includes('nav a[aria-current]'), 'no current nav item rule uses --red');
});

test('the writing desk, which is not in dist, only takes the shared red focus outline', () => {
  const desk = readFileSync(join(SRC, 'integrations/scrivania/scrivi.astro'), 'utf8');
  const styles = inlineStyles(desk);
  const rejected = redRules(styles, 'scrivi.astro').filter((rule) => !isAllowedRedSelector(rule.selector));
  assert.deepEqual(rejected, []);
  // An override that removes or recolors the outline would hide the red ring on the desk's fields.
  assert.doesNotMatch(styles, /outline:\s*(none|[^;]*var\(--ink\))/);
});
