import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { contrast } from './support/contrast.ts';

type Theme = 'light' | 'dark';

/** Reads every `--name: light-dark(#light, #dark)` token from the contract file. */
const tokens = (): Record<Theme, Map<string, string>> => {
  const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
  const result = { light: new Map<string, string>(), dark: new Map<string, string>() };
  for (const [, name, light, dark] of css.matchAll(/--([\w-]+):\s*light-dark\((#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)/gi)) {
    result.light.set(name ?? '', light ?? '');
    result.dark.set(name ?? '', dark ?? '');
  }
  return result;
};

const AA_TEXT = 4.5;
type Pair = readonly [foreground: string, background: string];

const TEXT_PAIRS: Pair[] = [
  ['ink', 'bg'],
  ['muted', 'bg'],
  ['ink', 'surface'],
  ['muted', 'surface'],
];
const TINT_PAIRS: Pair[] = [1, 2, 3, 4, 5].map((n) => [`tint-${n}-ink`, `tint-${n}`]);

test('the contrast helper matches WCAG worked examples', () => {
  assert.equal(contrast('#000000', '#ffffff'), 21);
  assert.equal(contrast('#767676', '#ffffff').toFixed(2), '4.54');
  assert.equal(contrast('#777777', '#ffffff').toFixed(2), '4.48');
});

for (const theme of ['light', 'dark'] as const) {
  test(`every text and tint pair passes WCAG AA in the ${theme} theme`, () => {
    const colors = tokens()[theme];
    for (const [fg, bg] of [...TEXT_PAIRS, ...TINT_PAIRS]) {
      const [a, b] = [colors.get(fg), colors.get(bg)];
      if (!a || !b) return assert.fail(`missing token --${fg} or --${bg}`);
      const ratio = contrast(a, b);
      assert.ok(ratio >= AA_TEXT, `--${fg} on --${bg} is ${ratio.toFixed(2)}:1 in ${theme}`);
    }
  });
}
