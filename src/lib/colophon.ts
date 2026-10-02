export interface ColophonLine {
  term: string;
  detail: string;
}

/**
 * The six colophon facts (SPEC.md §8): typeface, math, notes, build, hosting, writing.
 * These describe the site itself, not the author, so an agent writes them directly.
 */
export const colophon: { it: readonly ColophonLine[]; en: readonly ColophonLine[] } = {
  it: [
    { term: 'Carattere', detail: 'Host Grotesk.' },
    { term: 'Matematica', detail: 'MathML, resa dal browser senza JavaScript.' },
    { term: 'Appunti', detail: 'LaTeX convertito in HTML con LaTeXML, fuori dalla build del sito.' },
    { term: 'Costruzione', detail: 'Astro, output statico.' },
    { term: 'Hosting', detail: 'Cloudflare Workers.' },
    { term: 'Scrittura', detail: 'Markdown, da una scrivania locale.' },
  ],
  en: [
    { term: 'Typeface', detail: 'Host Grotesk.' },
    { term: 'Math', detail: 'MathML, rendered by the browser without JavaScript.' },
    { term: 'Notes', detail: 'LaTeX converted to HTML with LaTeXML, outside the site build.' },
    { term: 'Build', detail: 'Astro, static output.' },
    { term: 'Hosting', detail: 'Cloudflare Workers.' },
    { term: 'Writing', detail: 'Markdown, from a local writing desk.' },
  ],
};
