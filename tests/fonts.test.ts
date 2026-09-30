import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildSite, builtPages, filesWithExtension, read } from './support/built-site.ts';

/** All CSS the browser sees: stylesheets plus inline <style> blocks. */
const allCss = (dist: string): string => {
  const sheets = filesWithExtension(dist, '.css').map((file) => read(dist, file));
  const inline = filesWithExtension(dist, '.html').flatMap((page) =>
    [...read(dist, page).matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((match) => match[1] ?? ''),
  );
  return [...sheets, ...inline].join('\n');
};

const fontFaces = (css: string): string[] => [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map((m) => m[1] ?? '');

test('Host Grotesk is self-hosted in roman and italic', () => {
  const dist = buildSite();
  const faces = fontFaces(allCss(dist)).filter((face) => /font-family:\s*["']?Host Grotesk/.test(face));
  for (const style of ['normal', 'italic']) {
    const face = faces.find((f) => new RegExp(`font-style:\\s*${style}`).test(f));
    assert.ok(face, `no ${style} Host Grotesk face`);
    const url = face?.match(/url\(["']?(\/[^"')]+\.woff2)["']?\)/)?.[1];
    assert.ok(url, `the ${style} face has no local woff2 source`);
    assert.ok(existsSync(join(dist, url)), `${url} is missing from the build`);
  }
});

test('no page loads anything from another origin', () => {
  const dist = buildSite();
  for (const { page, html } of builtPages()) {
    assert.doesNotMatch(html, /<(link|script)[^>]+(href|src)="(https?:)?\/\//, `${page} loads an external resource`);
  }
  assert.doesNotMatch(allCss(dist), /url\(["']?(https?:)?\/\//, 'CSS loads an external resource');
});
