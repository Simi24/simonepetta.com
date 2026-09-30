import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { CLOUDFLARE_BEACON_SCRIPT_SRC } from '../src/config/budget.ts';
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

// `<link rel="canonical">` and `<link rel="alternate" hreflang>` are metadata for crawlers,
// required as absolute URLs (SPEC.md §8, §12.3); unlike a stylesheet or script, the browser
// never fetches them, so they don't belong to "loads" here.
const NON_LOADING_LINK_RELS = ['canonical', 'alternate'];

const externalResourceTags = (html: string): RegExpMatchArray[] =>
  [...html.matchAll(/<(link|script)\b[^>]*>/g)].filter((match) => {
    const tag = match[0];
    // The Web Analytics beacon is the one declared exception (SPEC.md §12.4): its exact script
    // URL, and only that, is allowed — a lookalike on another host or path is still caught below.
    if (match[1] === 'script' && /\bsrc="([^"]*)"/.exec(tag)?.[1] === CLOUDFLARE_BEACON_SCRIPT_SRC) return false;
    if (!/(href|src)="(https?:)?\/\//.test(tag)) return false;
    if (match[1] !== 'link') return true;
    const rel = /\brel="([^"]*)"/.exec(tag)?.[1]?.split(/\s+/) ?? [];
    // Non-loading only when EVERY rel token is on the allowlist (so `alternate stylesheet`,
    // which the browser does fetch, is not exempted just because `alternate` is present),
    // and `alternate` alone is non-loading only paired with `hreflang` (not a bare feed link).
    if (rel.length === 0) return true;
    if (!rel.every((value) => NON_LOADING_LINK_RELS.includes(value))) return true;
    if (rel.includes('alternate') && !/\bhreflang="/.test(tag)) return true;
    return false;
  });

test('an external "alternate stylesheet" link is still caught (pins the relaxed gate)', () => {
  const html = '<link rel="alternate stylesheet" href="https://cdn.example.com/a.css">';
  assert.equal(externalResourceTags(html).length, 1, 'an alternate stylesheet load must not be exempted');
});

test('a lookalike script is still caught: same host wrong path, and right path wrong host', () => {
  const wrongPath = '<script src="https://static.cloudflareinsights.com/other.js"></script>';
  const wrongHost = '<script src="https://static.cloudflareinsights.com.evil.example/beacon.min.js"></script>';
  assert.equal(externalResourceTags(wrongPath).length, 1, 'a different script on the beacon host must not be exempted');
  assert.equal(externalResourceTags(wrongHost).length, 1, 'a lookalike host must not be exempted');
});

test('no page loads anything from another origin', () => {
  const dist = buildSite();
  for (const { page, html } of builtPages()) {
    const tags = externalResourceTags(html);
    assert.equal(tags.length, 0, `${page} loads an external resource: ${tags.map((t) => t[0]).join(', ')}`);
  }
  assert.doesNotMatch(allCss(dist), /url\(["']?(https?:)?\/\//, 'CSS loads an external resource');
});

test('with the beacon enabled, its exact script URL is the only external load allowed', () => {
  const env = { CLOUDFLARE_BEACON_TOKEN: 'test-token', SITE_INDEXABLE: 'true' };
  for (const { page, html } of builtPages(env)) {
    const tags = externalResourceTags(html);
    assert.equal(tags.length, 0, `${page} loads an unexpected external resource: ${tags.map((t) => t[0]).join(', ')}`);
    assert.match(html, new RegExp(`src="${CLOUDFLARE_BEACON_SCRIPT_SRC.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  }
});
