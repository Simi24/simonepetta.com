import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { installConversion } from '../pipeline/appunti-install.ts';
import { prepareBuild } from '../pipeline/appunti-build.ts';
import { recoverInterruptedSwap, swapIn, type Staged } from '../pipeline/course-swap.ts';
import { makeTempDir } from './support/temp-root.ts';

const FIXTURES = new URL('./fixtures/latexml/', import.meta.url).pathname;

const text = (name: string, content: string): Staged => ({ name, write: (path) => writeFileSync(path, content) });
const dirOf = (name: string, files: Record<string, string>): Staged => ({
  name,
  write: (path) => {
    mkdirSync(path);
    for (const [file, content] of Object.entries(files)) writeFileSync(join(path, file), content);
  },
});

/** A course folder with an old build/, PDF and meta.json. */
function course(withOld = true): string {
  const dir = makeTempDir('appunti-swap-');
  if (withOld) {
    mkdirSync(join(dir, 'build'));
    writeFileSync(join(dir, 'build/a.html'), 'old build');
    writeFileSync(join(dir, 'c.pdf'), 'old pdf');
    writeFileSync(join(dir, 'meta.json'), 'old meta');
  }
  return dir;
}

const entries = (): Staged[] => [dirOf('build', { 'a.html': 'new build' }), text('c.pdf', 'new pdf'), text('meta.json', 'new meta')];

/** The visible state of the course: every file under it, with its content. */
function snapshot(dir: string): Record<string, string> {
  const state: Record<string, string> = {};
  for (const file of readdirSync(dir, { recursive: true, encoding: 'utf8' }).sort()) {
    const path = join(dir, file);
    try {
      state[file] = readFileSync(path, 'utf8');
    } catch {
      state[file] = '<dir>';
    }
  }
  return state;
}

const OLD = { build: '<dir>', 'build/a.html': 'old build', 'c.pdf': 'old pdf', 'meta.json': 'old meta' };
const NEW = { build: '<dir>', 'build/a.html': 'new build', 'c.pdf': 'new pdf', 'meta.json': 'new meta' };

test('the build, the PDF and meta.json are swapped in together, leaving nothing behind', () => {
  const dir = course();
  swapIn(dir, entries());
  assert.deepEqual(snapshot(dir), NEW);
});

test('a first conversion, with nothing to replace, installs all three', () => {
  const dir = course(false);
  swapIn(dir, entries());
  assert.deepEqual(snapshot(dir), NEW);
});

test('a crash between any two renames leaves either the old course or the new one, never a mix', () => {
  for (const withOld of [true, false]) {
    for (let crashAt = 0; crashAt < 6; crashAt++) {
      const dir = course(withOld);
      let renames = 0;
      const crashing = (from: string, to: string): void => {
        if (renames++ === crashAt) throw new Error('simulated crash');
        renameSync(from, to);
      };
      try {
        swapIn(dir, entries(), { rename: crashing });
      } catch {
        // the process "died" here
      }
      recoverInterruptedSwap(dir);
      const state = snapshot(dir);
      const label = `old=${withOld} crash at rename ${crashAt}`;
      if (withOld) assert.ok(JSON.stringify(state) === JSON.stringify(OLD) || JSON.stringify(state) === JSON.stringify(NEW), `${label}: ${JSON.stringify(state)}`);
      else assert.ok(Object.keys(state).length === 0 || JSON.stringify(state) === JSON.stringify(NEW), `${label}: ${JSON.stringify(state)}`);
    }
  }
});

test('the next run recovers an interrupted swap by itself before doing anything else', () => {
  const dir = course();
  let renames = 0;
  assert.throws(() =>
    swapIn(dir, entries(), {
      rename: (from, to) => {
        if (renames++ === 4) throw new Error('simulated crash');
        renameSync(from, to);
      },
    }),
  );
  swapIn(dir, [text('meta.json', 'newer meta')]);
  assert.equal(readFileSync(join(dir, 'build/a.html'), 'utf8'), 'old build', 'the interrupted swap was rolled back, not half kept');
  assert.equal(readFileSync(join(dir, 'meta.json'), 'utf8'), 'newer meta');
  assert.ok(!existsSync(join(dir, '.swap-journal.json')));
});

test('a write that fails while staging changes nothing', () => {
  const dir = course();
  const broken: Staged = {
    name: 'c.pdf',
    write: () => {
      throw new Error('disk full');
    },
  };
  assert.throws(() => swapIn(dir, [dirOf('build', { 'a.html': 'new build' }), broken, text('meta.json', 'new meta')]), /disk full/);
  const state = snapshot(dir);
  for (const [file, content] of Object.entries(OLD)) assert.equal(state[file], content);
  assert.deepEqual(Object.keys(state).filter((file) => file.endsWith('.next')), []);
});

/** A Docker-free conversion: the mini course's LaTeXML pages and a PDF stand-in. */
function prepared(courseDir: string) {
  const htmlDir = makeTempDir('appunti-install-html-');
  cpSync(join(FIXTURES, 'mini-Ch1.html'), join(htmlDir, 'Ch1.html'));
  cpSync(join(FIXTURES, 'mini-Ch2.html'), join(htmlDir, 'Ch2.html'));
  return prepareBuild({
    htmlDir,
    courseDir,
    corso: 'mini',
    source: readFileSync(join(FIXTURES, 'mini-src/main.tex'), 'utf8'),
    latexmlErrors: 0,
  });
}

test('installing a conversion writes build/, the PDF and meta.json with the page count', () => {
  const dir = course(false);
  const pdf = join(dir, 'staging.pdf');
  writeFileSync(pdf, 'the new pdf');
  installConversion({ courseDir: dir, corso: 'mini', prepared: prepared(dir), pdfPath: pdf, pageCount: () => 7 });
  assert.equal(readFileSync(join(dir, 'mini.pdf'), 'utf8'), 'the new pdf');
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')), { pagine: 7 });
  assert.ok(existsSync(join(dir, 'build/meta.json')));
});

test('a missing pdfinfo fails before anything is written: build/, the PDF and meta.json stay as they were', () => {
  const dir = course();
  const pdf = join(dir, 'staging.pdf');
  writeFileSync(pdf, 'the new pdf');
  const before = snapshot(dir);
  const emptyBin = makeTempDir('appunti-empty-path-');
  const path = process.env['PATH'];
  process.env['PATH'] = emptyBin;
  try {
    assert.throws(() => installConversion({ courseDir: dir, corso: 'mini', prepared: prepared(dir), pdfPath: pdf }), /pdfinfo|ENOENT/);
  } finally {
    process.env['PATH'] = path;
  }
  assert.deepEqual(snapshot(dir), before);
});

test('a page count that fails leaves the old course in place', () => {
  const dir = course();
  const pdf = join(dir, 'staging.pdf');
  writeFileSync(pdf, 'the new pdf');
  const before = snapshot(dir);
  assert.throws(
    () =>
      installConversion({
        courseDir: dir,
        corso: 'mini',
        prepared: prepared(dir),
        pdfPath: pdf,
        pageCount: () => {
          throw new Error('pdfinfo failed');
        },
      }),
    /pdfinfo failed/,
  );
  assert.deepEqual(snapshot(dir), before);
});
