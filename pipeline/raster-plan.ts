import { tokenize, attribute } from './html-tokens.ts';

/** The `src` of every `<img>` of a LaTeXML page, in order. */
export const imageSources = (html: string): string[] =>
  tokenize(html).flatMap((token) => (token.type === 'open' && token.name === 'img' ? [attribute(token, 'src') ?? ''] : []));

/**
 * The WebP file name of each image, flat: `images/architetture/a.png` is `images-architetture-a.webp`.
 * Two images that would share a name fail the conversion instead of one overwriting the other.
 */
export function planRasters(sources: readonly string[]): Map<string, string> {
  const plan = new Map<string, string>();
  const owner = new Map<string, string>();
  for (const src of sources) {
    if (plan.has(src)) continue;
    if (src === '' || src.startsWith('/') || src.split('/').includes('..')) throw new Error(`cannot convert the image "${src}": it points outside the course`);
    const name = `${src.replace(/\.[^./]+$/, '').replace(/[^A-Za-z0-9._]+/g, '-')}.webp`;
    const other = owner.get(name);
    if (other !== undefined) throw new Error(`the images "${other}" and "${src}" would both be ${name}`);
    owner.set(name, src);
    plan.set(src, name);
  }
  return plan;
}
