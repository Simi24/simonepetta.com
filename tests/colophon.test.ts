import assert from 'node:assert/strict';
import { test } from 'node:test';
import { colophon } from '../src/lib/colophon.ts';

test('the colophon has the six facts from SPEC.md §8, in Italian and English', () => {
  for (const lang of ['it', 'en'] as const) {
    assert.equal(colophon[lang].length, 6, `${lang} colophon must have exactly six lines`);
  }
});

test('each line names its fact and is not empty', () => {
  for (const lang of ['it', 'en'] as const) {
    for (const { term, detail } of colophon[lang]) {
      assert.ok(term.length > 0, `${lang}: a colophon term is empty`);
      assert.ok(detail.length > 0, `${lang}: a colophon detail is empty`);
    }
  }
});

test('the facts cover typeface, math, notes, build, hosting and writing', () => {
  const it = colophon.it.map((line) => line.detail).join(' ');
  assert.match(it, /Host Grotesk/);
  assert.match(it, /MathML/);
  assert.match(it, /LaTeXML/);
  assert.match(it, /Astro/);
  assert.match(it, /Cloudflare Workers/);
  assert.match(it, /Markdown/);
  assert.doesNotMatch(it, /modelli linguistici|assistente/);

  const en = colophon.en.map((line) => line.detail).join(' ');
  assert.match(en, /Host Grotesk/);
  assert.match(en, /MathML/);
  assert.match(en, /LaTeXML/);
  assert.match(en, /Astro/);
  assert.match(en, /Cloudflare Workers/);
  assert.match(en, /Markdown/);
  assert.doesNotMatch(en, /language models|assistant/);
});
