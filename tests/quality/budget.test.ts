import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { checkBudget } from '../../scripts/quality/check-budget.ts';
import { shouldBuildFreshDist } from '../../scripts/quality/quality-dists.ts';
import { CLOUDFLARE_BEACON_SCRIPT_SRC, isPagefindAsset } from '../../src/config/budget.ts';
import { buildSite } from '../support/built-site.ts';

/** A minimal fixture "dist" with the given files, for exercising the checker without an Astro build. */
function fixtureDist(files: Record<string, string>): string {
  const dist = mkdtempSync(join(tmpdir(), 'budget-fixture-'));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dist, path)), { recursive: true });
    writeFileSync(join(dist, path), content);
  }
  return dist;
}

test('the current site passes the byte budget (SPEC.md §12.2)', () => {
  assert.deepEqual(checkBudget(buildSite()), []);
});

test('a page with oversized inline JS fails the budget', () => {
  // Random hex, not repeated characters, so gzip cannot shrink it below the cap.
  const oversized = randomBytes(4000).toString('hex');
  const dist = fixtureDist({
    'index.html': `<!doctype html><html><head><script>${oversized}</script></head><body></body></html>`,
  });
  const violations = checkBudget(dist);
  assert.ok(violations.some((v) => v.page === 'index.html' && /JS is \d+ B gzip, over/.test(v.message)));
});

test('a page with oversized HTML fails the budget', () => {
  const oversized = randomBytes(50_000).toString('hex');
  const dist = fixtureDist({ 'index.html': `<!doctype html><html><body><p>${oversized}</p></body></html>` });
  const violations = checkBudget(dist);
  assert.ok(violations.some((v) => v.page === 'index.html' && /HTML is \d+ B gzip, over/.test(v.message)));
});

test('an empty dist fails the budget check', () => {
  const dist = fixtureDist({});
  const violations = checkBudget(dist);
  assert.ok(violations.length > 0, 'an empty dist (or one with no HTML pages) must not pass silently');
});

test('a linked stylesheet is measured with `href` before `rel` (attribute order independence)', () => {
  const oversized = randomBytes(20_000).toString('hex'); // gzips over the 20 KB CSS cap
  const dist = fixtureDist({
    'index.html': '<!doctype html><html><head><link href="/big.css" rel="stylesheet"></head><body></body></html>',
    'big.css': `.oversized{content:"${oversized}"}`,
  });
  const violations = checkBudget(dist);
  assert.ok(violations.some((v) => v.page === 'index.html' && /CSS is \d+ B gzip, over/.test(v.message)));
});

test('a multi-value `rel` still counts as a stylesheet', () => {
  const oversized = randomBytes(20_000).toString('hex');
  const dist = fixtureDist({
    'index.html':
      '<!doctype html><html><head><link href="/big.css" rel="preload stylesheet"></head><body></body></html>',
    'big.css': `.oversized{content:"${oversized}"}`,
  });
  const violations = checkBudget(dist);
  assert.ok(violations.some((v) => v.page === 'index.html' && /CSS is \d+ B gzip, over/.test(v.message)));
});

test('a JSON-LD script block does not count toward the JS budget', () => {
  // Large enough to bust the 1 KB JS cap if it were (wrongly) counted as JS.
  const jsonLd = JSON.stringify({ '@context': 'https://schema.org', '@type': 'LearningResource', id: randomBytes(4000).toString('hex') });
  const dist = fixtureDist({
    'index.html': `<!doctype html><html><head><script type="application/ld+json">${jsonLd}</script></head><body></body></html>`,
  });
  assert.deepEqual(checkBudget(dist), []);
});

test('the Cloudflare beacon script is an accepted cost, not measured against the JS budget', () => {
  const dist = fixtureDist({
    'index.html': `<!doctype html><html><head><script defer src="${CLOUDFLARE_BEACON_SCRIPT_SRC}" data-cf-beacon='{"token":"x"}'></script></head><body></body></html>`,
  });
  assert.deepEqual(checkBudget(dist), []);
});

test('an external script other than the beacon is an undeclared-script violation, not silently free', () => {
  const dist = fixtureDist({
    'index.html': '<!doctype html><html><head><script src="https://example.com/analytics.js"></script></head><body></body></html>',
  });
  const violations = checkBudget(dist);
  assert.ok(
    violations.some((v) => v.page === 'index.html' && /undeclared external script: https:\/\/example\.com\/analytics\.js/.test(v.message)),
  );
});

test('without an explicit reuse flag, a standalone run always rebuilds `dist`', () => {
  assert.equal(shouldBuildFreshDist({ reuseDist: false, distExists: true }), true);
  assert.equal(shouldBuildFreshDist({ reuseDist: false, distExists: false }), true);
});

test('with the reuse flag, an existing `dist` is trusted; a missing one still builds', () => {
  assert.equal(shouldBuildFreshDist({ reuseDist: true, distExists: true }), false);
  assert.equal(shouldBuildFreshDist({ reuseDist: true, distExists: false }), true);
});

const PAGEFIND_UI = '<script src="/pagefind/pagefind-ui.js"></script>';
const bigJs = (): string => `window.x="${randomBytes(4000).toString('hex')}"`;

test('on /cerca/, Pagefind assets are exempt from the JS budget', () => {
  const dist = fixtureDist({
    'cerca/index.html': `<!doctype html><html><head>${PAGEFIND_UI}</head><body></body></html>`,
    'pagefind/pagefind-ui.js': bigJs(),
  });
  assert.deepEqual(checkBudget(dist), []);
});

test('on /cerca/, JS that is not a Pagefind asset still counts against the JS budget', () => {
  const dist = fixtureDist({
    'cerca/index.html': `<!doctype html><html><head>${PAGEFIND_UI}<script>${bigJs()}</script></head><body></body></html>`,
    'pagefind/pagefind-ui.js': bigJs(),
  });
  const violations = checkBudget(dist);
  assert.ok(violations.some((v) => v.page === 'cerca/index.html' && /JS is \d+ B gzip, over/.test(v.message)));
});

test('on any other page, Pagefind assets are not exempt from the JS budget', () => {
  const dist = fixtureDist({
    'letture/index.html': `<!doctype html><html><head>${PAGEFIND_UI}</head><body></body></html>`,
    'pagefind/pagefind-ui.js': bigJs(),
  });
  const violations = checkBudget(dist);
  assert.ok(violations.some((v) => v.page === 'letture/index.html' && /JS is \d+ B gzip, over/.test(v.message)));
});

test('the Pagefind exception accepts only plain Pagefind file paths on /cerca/', () => {
  assert.equal(isPagefindAsset('cerca/index.html', '/pagefind/pagefind-ui.js'), true);
  for (const src of [
    '/pagefind/../big.js',
    '/pagefind/%2e%2e/big.js',
    '/pagefind/sub/dir.js',
    '/pagefind/pagefind-ui.js?x=1',
    '/pagefind/pagefind-ui.js#x',
    '/pagefind/',
    '/pagefindx/pagefind-ui.js',
  ]) {
    assert.equal(isPagefindAsset('cerca/index.html', src), false, src);
  }
});

test('a path-traversal script on /cerca/ is not exempt from the JS budget', () => {
  const dist = fixtureDist({
    'cerca/index.html': '<!doctype html><html><head><script src="/pagefind/../big.js"></script></head><body></body></html>',
    'big.js': bigJs(),
  });
  const violations = checkBudget(dist);
  assert.ok(violations.some((v) => v.page === 'cerca/index.html' && /JS is \d+ B gzip, over/.test(v.message)));
});

test('an external stylesheet is an undeclared-stylesheet violation, not silently free', () => {
  const dist = fixtureDist({
    'index.html': '<!doctype html><html><head><link rel="stylesheet" href="https://cdn.example.com/a.css"></head><body></body></html>',
  });
  const violations = checkBudget(dist);
  assert.ok(
    violations.some((v) => v.page === 'index.html' && /undeclared external stylesheet: https:\/\/cdn\.example\.com\/a\.css/.test(v.message)),
  );
});

const CHAT_PAGE = 'appunti/algebra/chat/index.html';
const ISLAND = '<script type="module" src="/_astro/Chat.abc123.js"></script>';

test('on a chat page, Astro-bundled island scripts are exempt from the JS budget', () => {
  const dist = fixtureDist({
    [CHAT_PAGE]: `<!doctype html><html><head>${ISLAND}</head><body></body></html>`,
    '_astro/Chat.abc123.js': bigJs(),
  });
  assert.deepEqual(checkBudget(dist), []);
});

test('on a chat page, inline JS still counts against the JS budget', () => {
  const dist = fixtureDist({
    [CHAT_PAGE]: `<!doctype html><html><head>${ISLAND}<script>${bigJs()}</script></head><body></body></html>`,
    '_astro/Chat.abc123.js': bigJs(),
  });
  const violations = checkBudget(dist);
  assert.ok(violations.some((v) => v.page === CHAT_PAGE && /JS is \d+ B gzip, over/.test(v.message)));
});

test('on a chat page, JS outside /_astro/ still counts against the JS budget', () => {
  const dist = fixtureDist({
    [CHAT_PAGE]: '<!doctype html><html><head><script src="/other/big.js"></script></head><body></body></html>',
    'other/big.js': bigJs(),
  });
  const violations = checkBudget(dist);
  assert.ok(violations.some((v) => v.page === CHAT_PAGE && /JS is \d+ B gzip, over/.test(v.message)));
});

test('on any other page, /_astro/ scripts are not exempt from the JS budget', () => {
  const dist = fixtureDist({
    'index.html': `<!doctype html><html><head>${ISLAND}</head><body></body></html>`,
    '_astro/Chat.abc123.js': bigJs(),
  });
  const violations = checkBudget(dist);
  assert.ok(violations.some((v) => v.page === 'index.html' && /JS is \d+ B gzip, over/.test(v.message)));
});

/** A page whose inline CSS declares one @font-face; `files` adds the woff2 files it may reference. */
function fontDist(face: string, files: Record<string, string> = {}): string {
  return fixtureDist({
    'index.html': `<!doctype html><html><head><style>${face}</style></head><body></body></html>`,
    ...files,
  });
}

/** The `wOF2` signature every woff2 file starts with, plus filler. */
const WOFF2 = 'wOF2\u0000\u0001\u0000\u0000 font data';

const HOST_ROMAN = "@font-face{font-family:'Host Grotesk';font-style:normal;src:url('/fonts/host-grotesk-latin.woff2') format('woff2')}";

test('a declared font face with its declared woff2 file passes', () => {
  assert.deepEqual(checkBudget(fontDist(HOST_ROMAN, { 'fonts/host-grotesk-latin.woff2': WOFF2 })), []);
});

test('a font face whose woff2 file is missing from dist is a violation', () => {
  const violations = checkBudget(fontDist(HOST_ROMAN));
  assert.ok(violations.some((v) => /host-grotesk-latin\.woff2.*missing/.test(v.message)));
});

test('an allowed family served from another woff2 file (wrong subset) is a violation', () => {
  const face = HOST_ROMAN.replace('host-grotesk-latin.woff2', 'host-grotesk-full.woff2');
  const violations = checkBudget(fontDist(face, { 'fonts/host-grotesk-full.woff2': WOFF2 }));
  assert.ok(violations.some((v) => /Host Grotesk.*normal.*host-grotesk-full\.woff2/.test(v.message)));
});

test('the italic face pointing at the roman file is a violation (wrong style)', () => {
  const face = HOST_ROMAN.replace('normal', 'italic');
  const violations = checkBudget(fontDist(face, { 'fonts/host-grotesk-latin.woff2': WOFF2 }));
  assert.ok(violations.some((v) => /Host Grotesk.*italic.*host-grotesk-latin\.woff2/.test(v.message)));
});

test('a font face from another origin is a violation', () => {
  const face = HOST_ROMAN.replace("/fonts/host-grotesk-latin.woff2", 'https://fonts.example.com/h.woff2');
  const violations = checkBudget(fontDist(face));
  assert.ok(violations.some((v) => /https:\/\/fonts\.example\.com\/h\.woff2/.test(v.message)));
});

test('an undeclared font family is a violation', () => {
  const face = "@font-face{font-family:'Comic Sans';src:url('/fonts/c.woff2') format('woff2')}";
  const violations = checkBudget(fontDist(face, { 'fonts/c.woff2': WOFF2 }));
  assert.ok(violations.some((v) => /undeclared font family "Comic Sans"/.test(v.message)));
});

test('Fira Math on a page that is not a declared math page is a violation', () => {
  const face = "@font-face{font-family:'Fira Math';font-style:normal;src:url('/fonts/fira-math.woff2') format('woff2')}";
  const violations = checkBudget(fontDist(face, { 'fonts/fira-math.woff2': WOFF2 }));
  assert.ok(violations.some((v) => /Fira Math but is not a declared math page/.test(v.message)));
});

test('a font face with no font-style counts as normal', () => {
  const face = "@font-face{font-family:'Host Grotesk';src:url('/fonts/host-grotesk-latin.woff2') format('woff2')}";
  assert.deepEqual(checkBudget(fontDist(face, { 'fonts/host-grotesk-latin.woff2': WOFF2 })), []);
});

/** Runs the gate CLI on an existing fixture `dist` (reuse flag set, so nothing is built). */
function runBudgetCli(dist: string): { status: number | null; stderr: string; stdout: string } {
  const result = spawnSync(process.execPath, ['scripts/quality/check-budget.ts', dist], {
    encoding: 'utf8',
    env: { ...process.env, QUALITY_GATE_REUSE_DIST: '1' },
  });
  return { status: result.status, stderr: result.stderr, stdout: result.stdout };
}

test('the CLI exits 0 on a dist within budget', () => {
  const dist = fixtureDist({ 'index.html': '<!doctype html><html><body></body></html>' });
  const { status, stdout } = runBudgetCli(dist);
  assert.equal(status, 0);
  assert.match(stdout, /OK/);
});

test('the CLI exits 1 and names the page when a CSS cap is exceeded', () => {
  const oversized = randomBytes(20_000).toString('hex');
  const dist = fixtureDist({ 'index.html': `<!doctype html><html><head><style>.x{content:"${oversized}"}</style></head><body></body></html>` });
  const { status, stderr } = runBudgetCli(dist);
  assert.equal(status, 1);
  assert.match(stderr, /index\.html: CSS is \d+ B gzip, over/);
});

test('the CLI exits 1 on an undeclared font file', () => {
  const dist = fontDist(HOST_ROMAN.replace('host-grotesk-latin.woff2', 'other.woff2'), { 'fonts/other.woff2': WOFF2 });
  const { status, stderr } = runBudgetCli(dist);
  assert.equal(status, 1);
  assert.match(stderr, /undeclared file: \/fonts\/other\.woff2/);
});

test('a font face with a second, external url() source is a violation', () => {
  const face = HOST_ROMAN.replace(
    "format('woff2')}",
    "format('woff2'),url(https://evil.example/x.woff2)}",
  );
  const violations = checkBudget(fontDist(face, { 'fonts/host-grotesk-latin.woff2': WOFF2 }));
  assert.ok(violations.some((v) => /https:\/\/evil\.example\/x\.woff2/.test(v.message)));
});

test('a font face with a second, undeclared local url() source is a violation', () => {
  const face = HOST_ROMAN.replace("format('woff2')}", "format('woff2'),url('/fonts/other.woff2')}");
  const violations = checkBudget(fontDist(face, { 'fonts/host-grotesk-latin.woff2': WOFF2, 'fonts/other.woff2': WOFF2 }));
  assert.ok(violations.some((v) => /undeclared file: \/fonts\/other\.woff2/.test(v.message)));
});

test('an external @import in CSS is a violation, in both url() and string form', () => {
  for (const rule of ['@import url(https://evil.example/a.css);', "@import 'https://evil.example/a.css';", '@import "//evil.example/a.css";']) {
    const dist = fixtureDist({ 'index.html': `<!doctype html><html><head><style>${rule}</style></head><body></body></html>` });
    const violations = checkBudget(dist);
    assert.ok(violations.some((v) => /evil\.example\/a\.css/.test(v.message)), rule);
  }
});

test('a local @import is not a violation', () => {
  const dist = fixtureDist({ 'index.html': '<!doctype html><html><head><style>@import "/a.css";</style></head><body></body></html>', 'a.css': 'p{}' });
  assert.deepEqual(checkBudget(dist), []);
});

test('an external <img>, <iframe> or CSS url() on any build is a violation', () => {
  const cases: Record<string, string> = {
    'https://evil.example/i.png': '<img src="https://evil.example/i.png" alt="">',
    'https://evil.example/frame': '<iframe src="https://evil.example/frame"></iframe>',
    '//evil.example/css.png': '<style>p{background:url(//evil.example/css.png)}</style>',
    'https://evil.example/q.png': '<style>p{background:url("https://evil.example/q.png")}</style>',
  };
  for (const [url, markup] of Object.entries(cases)) {
    const dist = fixtureDist({ 'index.html': `<!doctype html><html><head></head><body>${markup}</body></html>` });
    const violations = checkBudget(dist);
    assert.ok(violations.some((v) => v.message.includes(url)), url);
  }
});

test('links that are not loaded (anchors, canonical, hreflang alternates) are not external-resource violations', () => {
  const dist = fixtureDist({
    'index.html':
      '<!doctype html><html><head><link rel="canonical" href="https://simonepetta.com/"><link rel="alternate" hreflang="en" href="https://simonepetta.com/en/"></head><body><a href="https://example.com/">x</a><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt=""></body></html>',
  });
  assert.deepEqual(checkBudget(dist), []);
});

test('a referenced woff2 that is not woff2 (wrong magic bytes) is a violation', () => {
  const violations = checkBudget(fontDist(HOST_ROMAN, { 'fonts/host-grotesk-latin.woff2': '<html>not a font</html>' }));
  assert.ok(violations.some((v) => /host-grotesk-latin\.woff2.*not a woff2/.test(v.message)));
});

test('a referenced woff2 that is empty is a violation', () => {
  const violations = checkBudget(fontDist(HOST_ROMAN, { 'fonts/host-grotesk-latin.woff2': '' }));
  assert.ok(violations.some((v) => /host-grotesk-latin\.woff2.*not a woff2/.test(v.message)));
});
