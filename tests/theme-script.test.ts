import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { builtPages } from './support/built-site.ts';

/** Inline scripts only: external ones are the byte budget's concern (SPEC.md §12.2). */
const inlineScripts = (html: string): RegExpMatchArray[] =>
  [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter((match) => !/\bsrc=/.test(match[1] ?? ''));

test('every page has one inline theme script in the head, at most 1 KB gzip', () => {
  for (const { page, html } of builtPages()) {
    const head = html.slice(0, html.indexOf('</head>'));
    const [only, ...others] = inlineScripts(html);
    if (!only) return assert.fail(`${page} has no inline script`);
    assert.equal(others.length, 0, `${page} has more than one inline script`);
    assert.ok(head.includes(only[0]), `${page}: the theme script is not in the head`);
    const size = gzipSync(only[2] ?? '').length;
    assert.ok(size <= 1024, `${page}: theme script is ${size} bytes gzip`);
  }
});
