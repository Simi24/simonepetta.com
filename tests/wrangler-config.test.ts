import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildSite } from './support/built-site.ts';

const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));

test('the Worker serves static assets only, with no Worker script', () => {
  assert.equal(config.main, undefined, 'a `main` entrypoint makes this a Worker script, not assets-only');
  assert.equal(
    config.assets?.run_worker_first,
    undefined,
    'run_worker_first only applies when a Worker script runs ahead of assets',
  );
  assert.equal(
    config.assets?.binding,
    undefined,
    'an assets binding is only valid alongside a `main` script (SPEC.md §10.1)',
  );
});

test('assets serve dist, with the nearest 404 page on a miss', () => {
  assert.equal(config.assets?.directory, './dist');
  assert.equal(config.assets?.not_found_handling, '404-page');
});

test('the site routes only to the apex Custom Domain', () => {
  assert.deepEqual(config.routes, [{ pattern: 'simonepetta.com', custom_domain: true }]);
});

test('the production workers.dev hostname is disabled, preview URLs are enabled', () => {
  assert.equal(config.workers_dev, false, 'SPEC.md §11: the production workers.dev hostname stays disabled');
  assert.equal(config.preview_urls, true, 'SPEC.md §11: preview URLs are enabled in wrangler.jsonc');
});

test('a compatibility date is set', () => {
  assert.match(config.compatibility_date, /^\d{4}-\d{2}-\d{2}$/);
});

test('the built 404 page exists where not_found_handling expects it', () => {
  assert.equal(config.assets?.not_found_handling, '404-page');
  const dist = buildSite();
  assert.ok(existsSync(join(dist, '404.html')), 'dist/404.html is missing: not_found_handling would have nothing to serve');
});
