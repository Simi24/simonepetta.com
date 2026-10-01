import { copyFileSync, writeFileSync } from 'node:fs';
import { serializeCorsoMeta, pageCount as pdfPageCount } from './appunti-meta.ts';
import { stagedBuild, type PreparedBuild } from './appunti-build.ts';
import { swapIn } from './course-swap.ts';

export interface InstallInput {
  courseDir: string;
  corso: string;
  prepared: PreparedBuild;
  /** The freshly compiled PDF, outside the course folder. */
  pdfPath: string;
  /** Page count of the PDF; defaults to `pdfinfo`. Injectable so the write phase can be tested. */
  pageCount?: (pdfPath: string) => number;
}

/**
 * The write phase of a conversion: everything that can fail without touching the course
 * (the page count, which also proves `pdfinfo` works) runs first, then `build/`, the PDF and
 * `meta.json` are swapped in together (`course-swap.ts`). A failure at any step leaves the
 * course exactly as it was.
 */
export function installConversion(input: InstallInput): number {
  const pagine = (input.pageCount ?? pdfPageCount)(input.pdfPath);
  swapIn(input.courseDir, [
    stagedBuild(input.prepared.files),
    { name: `${input.corso}.pdf`, write: (path) => copyFileSync(input.pdfPath, path) },
    { name: 'meta.json', write: (path) => writeFileSync(path, serializeCorsoMeta({ pagine })) },
  ]);
  return pagine;
}
