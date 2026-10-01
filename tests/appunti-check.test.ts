import assert from 'node:assert/strict';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildFromLatexml } from '../pipeline/appunti-build.ts';
import { checkCourses } from '../pipeline/appunti-check.ts';
import { makeTempDir } from './support/temp-root.ts';

const LATEXML = new URL('./fixtures/latexml/', import.meta.url).pathname;
const SIMT = 'images/simtvssimd.png';
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3]);
const SOURCE = `\\chapter{Introduzione}\n\\includegraphics{${SIMT}}\n`;

const MANIFEST = 'titolo: "Fixture"\ntipo: corso\nlivello: triennale\nanno: 1\naa: "2021/22"\nfonte: github\n';

const pages = (count: number) => () => count;

/**
 * A content dir with one published course converted from LaTeXML's real output for GPUcomputing's
 * chapter 1 (one raster figure), the way the pipeline would leave it: `src/`, `build/`, PDF, `meta.json`.
 */
function convertedCourse(slug = 'gpu'): { contentDir: string; courseDir: string } {
  const root = makeTempDir('appunti-check-');
  const contentDir = join(root, 'appunti');
  const courseDir = join(contentDir, slug);
  const htmlDir = join(root, 'html');
  mkdirSync(join(courseDir, 'src'), { recursive: true });
  mkdirSync(htmlDir);
  cpSync(join(LATEXML, 'gpu-Ch1.html'), join(htmlDir, 'Ch1.html'));
  writeFileSync(join(courseDir, 'src/main.tex'), SOURCE);
  writeFileSync(join(courseDir, 'corso.yaml'), MANIFEST + 'pubblicato: true\n');
  writeFileSync(join(courseDir, `${slug}.pdf`), 'not read: the page count is injected');
  writeFileSync(join(courseDir, 'meta.json'), '{\n  "pagine": 12\n}\n');
  buildFromLatexml({
    htmlDir,
    courseDir,
    corso: slug,
    source: SOURCE,
    latexmlErrors: 0,
    figures: {
      rasters: new Map([[SIMT, { name: 'images-simtvssimd.webp', width: 830, height: 316 }]]),
      tikz: [],
      alt: { [SIMT]: 'Confronto fra SIMD e SIMT.' },
    },
    figureBytes: new Map([['images-simtvssimd.webp', WEBP]]),
  });
  return { contentDir, courseDir };
}

test('a converted course whose build/ matches its src/ and whose meta.json matches its PDF has no problems', () => {
  const { contentDir } = convertedCourse();
  const result = checkCourses(contentDir, { pageCount: pages(12) });
  assert.deepEqual(result.problems, []);
  assert.deepEqual(result.checked, ['gpu']);
});

test('a meta.json that disagrees with the PDF is a problem', () => {
  const { contentDir } = convertedCourse();
  const { problems } = checkCourses(contentDir, { pageCount: pages(13) });
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /gpu.*meta\.json.*12.*13/);
});

test('an image dropped from the committed build/ is caught', () => {
  const { contentDir, courseDir } = convertedCourse();
  const page = join(courseDir, 'build/1-introduzione.html');
  writeFileSync(page, '<p>Solo testo, senza più la figura. </p>'.repeat(3));
  const { problems } = checkCourses(contentDir, { pageCount: pages(12) });
  assert.match(problems.join('\n'), /gpu.*1 image.*0/);
});

test('a tikzpicture added to src/ with no SVG in the committed build/ is caught', () => {
  const { contentDir, courseDir } = convertedCourse();
  writeFileSync(join(courseDir, 'src/main.tex'), `${SOURCE}\\begin{tikzpicture}\\end{tikzpicture}\n`);
  const { problems } = checkCourses(contentDir, { pageCount: pages(12) });
  assert.match(problems.join('\n'), /gpu.*1 TikZ.*0/);
});

test('a figure whose description was emptied in the committed build/ is caught', () => {
  const { contentDir, courseDir } = convertedCourse();
  const page = join(courseDir, 'build/1-introduzione.html');
  const html = readFileSync(page, 'utf8').replace(/alt="[^"]*"/, 'alt=""');
  writeFileSync(page, html);
  const { problems } = checkCourses(contentDir, { pageCount: pages(12) });
  assert.match(problems.join('\n'), /no description/);
});

test('a course with a build/ but no src/ is a problem, not a skipped check', () => {
  const { contentDir, courseDir } = convertedCourse();
  rmSync(join(courseDir, 'src'), { recursive: true });
  const { problems } = checkCourses(contentDir, { pageCount: pages(12) });
  assert.match(problems.join('\n'), /gpu.*build\/.*src\//);
});

test('a published course with a PDF but no build/ only has its meta.json checked, and is counted', () => {
  const { contentDir, courseDir } = convertedCourse();
  rmSync(join(courseDir, 'build'), { recursive: true });
  rmSync(join(courseDir, 'src'), { recursive: true });
  const result = checkCourses(contentDir, { pageCount: pages(12) });
  assert.deepEqual(result, { checked: ['gpu'], problems: [] });
});

test('an unpublished course is not checked', () => {
  const { contentDir, courseDir } = convertedCourse();
  writeFileSync(join(courseDir, 'corso.yaml'), MANIFEST + 'pubblicato: false\nmotivo: "in attesa"\n');
  const result = checkCourses(contentDir, { pageCount: pages(99) });
  assert.equal(result.checked.length, 0);
  assert.match(result.problems.join('\n'), /no published course/);
});

test('a content dir with no courses at all fails rather than passing by checking nothing', () => {
  const contentDir = makeTempDir('appunti-check-empty-');
  const result = checkCourses(contentDir, { pageCount: pages(1) });
  assert.match(result.problems.join('\n'), /no published course/);
});

test('a published course with no PDF or no meta.json is a problem', () => {
  const { contentDir, courseDir } = convertedCourse();
  rmSync(join(courseDir, 'meta.json'));
  assert.match(checkCourses(contentDir, { pageCount: pages(12) }).problems.join('\n'), /gpu.*meta\.json/);
  const other = convertedCourse();
  rmSync(join(other.courseDir, 'gpu.pdf'));
  assert.match(checkCourses(other.contentDir, { pageCount: pages(12) }).problems.join('\n'), /gpu.*gpu\.pdf/);
});

test('a manifest the course schema rejects is reported, not skipped, even if the course would be published', () => {
  const { contentDir, courseDir } = convertedCourse();
  writeFileSync(join(courseDir, 'corso.yaml'), `${MANIFEST}pubblicato: "true"\n`);
  const { problems, checked } = checkCourses(contentDir, { pageCount: pages(12) });
  assert.match(problems.join('\n'), /gpu: corso\.yaml is invalid.*pubblicato/);
  assert.deepEqual(checked, []);
});
