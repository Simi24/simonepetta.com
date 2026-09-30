import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { buildSite, filesWithExtension, read } from './support/built-site.ts';

const scripts = (html: string): RegExpMatchArray[] => [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];

test('every page has one inline theme script in the head, at most 1 KB gzip', () => {
  const dist = buildSite();
  for (const page of filesWithExtension(dist, '.html')) {
    const html = read(dist, page);
    const head = html.slice(0, html.indexOf('</head>'));
    const [only, ...others] = scripts(html);
    if (!only) return assert.fail(`${page} has no script`);
    assert.equal(others.length, 0, `${page} has more than one script`);
    assert.ok(head.includes(only[0]), `${page}: the theme script is not in the head`);
    assert.doesNotMatch(only[1] ?? '', /\bsrc=/, `${page}: the theme script is not inline`);
    const size = gzipSync(only[2] ?? '').length;
    assert.ok(size <= 1024, `${page}: theme script is ${size} bytes gzip`);
  }
});
