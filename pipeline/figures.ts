/**
 * What the pipeline produced for a course's figures (SPEC.md §7.4), handed to the post-processor
 * so that it stays Docker-free: the re-encoding and the TikZ compilation happen in the container,
 * the HTML rewriting does not.
 */

/** No re-encoded image is wider than this (SPEC.md §7.4). */
export const MAX_RASTER_WIDTH = 1600;

/** A raster image re-encoded to WebP; `name` is its file in `build/figure/`. */
export interface Raster {
  name: string;
  width: number;
  height: number;
}

/** A TikZ picture compiled to SVG. `key` is where it is in the source (`img/up.tex#1`). */
export interface Tikz {
  key: string;
  svg: string;
}

export interface FigureAssets {
  /** Keyed by the `src` LaTeXML wrote for the image (`images/a.png`). */
  rasters: ReadonlyMap<string, Raster>;
  /** In document order, which is the order LaTeXML draws the pictures in. */
  tikz: readonly Tikz[];
  /** The drafted descriptions (`src/alt.json`), keyed by the image's `src` or the TikZ `key`. */
  alt: Readonly<Record<string, string>>;
}

export const NO_FIGURES: FigureAssets = { rasters: new Map(), tikz: [], alt: {} };

/** Where a course's re-encoded images are served from. */
export const figureUrl = (corso: string, name: string): string => `/appunti/${corso}/figure/${name}`;

export const escapeAttribute = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** The `<img>` for one converted raster, with the description the author can review in `alt.json`. */
export function rasterTag(corso: string, src: string, assets: FigureAssets): string {
  const raster = assets.rasters.get(src);
  if (raster === undefined) throw new Error(`the image "${src}" was not converted to WebP`);
  const alt = escapeAttribute(assets.alt[src] ?? '');
  return `<img class="figura" src="${figureUrl(corso, raster.name)}" width="${raster.width}" height="${raster.height}" loading="lazy" alt="${alt}">`;
}

const BLACK = /(['"])(?:#000000|#000|black)\1/g;

/**
 * dvisvgm's SVG as an inline figure (SPEC.md §7.4): black becomes `currentColor`, so the
 * picture takes the text color of both themes; ids (glyph paths) get a per-picture prefix, since
 * several pictures share a page; the description goes on the root as its accessible name.
 */
export function tikzSvg(tikz: Tikz, alt: string): string {
  const prefix = `${tikz.key.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')}-`;
  const body = tikz.svg
    .replace(/<\?xml[^>]*\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+xmlns(?::\w+)?='[^']*'/g, '')
    .replace(/xlink:href=/g, 'href=')
    .replace(BLACK, '"currentColor"')
    .replace(/\bid='([^']*)'/g, `id='${prefix}$1'`)
    .replace(/\bhref='#([^']*)'/g, `href='#${prefix}$1'`)
    .replace(/='([^']*)'/g, '="$1"')
    .trim();
  const attributes = `class="figura-tikz" role="img" aria-label="${escapeAttribute(alt)}"`;
  return body.replace(/^<svg\b(?:\s+version="[^"]*")?/, `<svg ${attributes}`);
}
