import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { NON_JS_SCRIPT_TYPES } from '../src/config/budget.ts';
import { builtPages } from './support/built-site.ts';

/** Inline scripts only, and only ones that run as JS: external and JSON-LD scripts are not this gate's concern. */
const inlineScripts = (html: string): RegExpMatchArray[] =>
  [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter((match) => {
    const attrs = match[1] ?? '';
    if (/\bsrc=/.test(attrs)) return false;
    const type = /\btype="([^"]*)"/.exec(attrs)?.[1];
    return !type || !(NON_JS_SCRIPT_TYPES as readonly string[]).includes(type);
  });

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
