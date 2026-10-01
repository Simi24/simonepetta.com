import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { makeTempDir } from './support/temp-root.ts';

// figures.sh normally runs in the container; with nothing to re-encode and nothing to compile it
// needs neither ImageMagick nor LaTeX, so its edge cases run here.
test('a course with no TikZ picture and no image runs the figures step to the end', () => {
  const work = makeTempDir('figures-script-');
  try {
    copyFileSync(new URL('../pipeline/figures.sh', import.meta.url), join(work, 'figures.sh'));
    writeFileSync(join(work, 'figures-rasters.txt'), '');
    mkdirSync(join(work, 'figures-tikz'));
    execFileSync('sh', ['figures.sh'], { cwd: work, stdio: 'pipe' });
    assert.ok(existsSync(join(work, 'figures-out/rasters.txt')));
    assert.equal(readFileSync(join(work, 'figures-out/rasters.txt'), 'utf8'), '');
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});
