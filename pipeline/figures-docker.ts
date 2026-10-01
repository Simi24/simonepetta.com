import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findTikz, tikzDocument } from './figure-sources.ts';
import { imageSources, planRasters } from './raster-plan.ts';
import { readAlt } from './alt-text.ts';
import { MAX_RASTER_WIDTH, type FigureAssets } from './figures.ts';

export interface MadeFigures {
  assets: FigureAssets;
  /** The WebP files, by name. */
  bytes: Map<string, Uint8Array>;
}

/**
 * Re-encodes the course's images and compiles its TikZ pictures, in the container (`figures.sh`):
 * the part of figure conversion that needs ImageMagick, LaTeX and dvisvgm. `work` is the
 * conversion's temporary directory, after BookML ran in it; `chapterPages` are LaTeXML's pages.
 */
export function makeFigures(options: {
  work: string;
  srcDir: string;
  chapterPages: readonly string[];
  runInContainer: (script: string) => void;
}): MadeFigures {
  const { work, srcDir } = options;
  const htmlDir = join(work, 'auxdir/html/main');

  const plan = planRasters(options.chapterPages.flatMap(imageSources));
  for (const src of plan.keys()) {
    if (!existsSync(join(htmlDir, src))) throw new Error(`LaTeXML did not copy the image "${src}" into its output`);
  }
  writeFileSync(join(work, 'figures-rasters.txt'), [...plan].map(([src, name]) => `${src} ${name}`).join('\n') + (plan.size > 0 ? '\n' : ''));

  const tikz = findTikz(srcDir);
  mkdirSync(join(work, 'figures-tikz'), { recursive: true });
  tikz.forEach((picture, i) => writeFileSync(join(work, 'figures-tikz', `${i + 1}.tex`), tikzDocument(srcDir, picture)));

  copyFileSync(new URL('./figures.sh', import.meta.url), join(work, 'figures.sh'));
  options.runInContainer('sh figures.sh');

  const out = join(work, 'figures-out');
  const rasters = new Map<string, { name: string; width: number; height: number }>();
  const bytes = new Map<string, Uint8Array>();
  const sizes = new Map(
    readFileSync(join(out, 'rasters.txt'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [name = '', width = '', height = ''] = line.split(' ');
        return [name, { name, width: Number(width), height: Number(height) }] as const;
      }),
  );
  for (const [src, name] of plan) {
    const size = sizes.get(name);
    if (size === undefined || !(size.width > 0 && size.height > 0)) throw new Error(`the image "${src}" was not re-encoded`);
    if (size.width > MAX_RASTER_WIDTH) throw new Error(`the image "${src}" is ${size.width} px wide after re-encoding`);
    rasters.set(src, size);
    bytes.set(name, readFileSync(join(out, name)));
  }

  return {
    assets: {
      rasters,
      tikz: tikz.map((picture, i) => ({ key: picture.key, svg: readFileSync(join(out, `${i + 1}.svg`), 'utf8') })),
      alt: readAlt(srcDir),
    },
    bytes,
  };
}
