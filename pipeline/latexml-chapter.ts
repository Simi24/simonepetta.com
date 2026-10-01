import {
  attribute,
  decodeEntities,
  elementEnd,
  hasClass,
  removeAttribute,
  serialize,
  setAttribute,
  textOf,
  tokenize,
  type Token,
} from './html-tokens.ts';

export interface ChapterHead {
  numero: number;
  titolo: string;
}

export interface Voce {
  id: string;
  numero: string;
  titolo: string;
}

/** A numbered section of a chapter, with its numbered subsections, for the chapter's table of contents. */
export interface Sezione extends Voce {
  sottosezioni: Voce[];
}

export interface LinkTargets {
  /** The course slug, for `/appunti/<corso>/`. */
  corso: string;
  /** LaTeXML's chapter file name (`Ch2.html`) to the chapter's site slug. */
  chapterSlugs: Readonly<Record<string, string>>;
}

export interface ProcessedChapter extends ChapterHead {
  sezioni: Sezione[];
  /** The chapter body as an HTML fragment (SPEC.md §7.3), without its heading. */
  html: string;
  hasMath: boolean;
  /** How many figures were replaced by the "pending" marker (figures are ticket #37). */
  figurePending: number;
  /** How many tcolorbox environments the stand-in binding marked (the markers are removed from `html`). */
  tcolorboxes: number;
  /** The plain text of each tcolorbox `title=`, which stays in `html` as a heading. */
  tcolorboxTitles: string[];
}

const FIGURE_PENDING = '<p class="figura-pending">Figura in attesa di conversione.</p>';

const withoutScripts = (html: string): string => html.replace(/<script\b[\s\S]*?<\/script>/gi, '');

function findOpen(tokens: readonly Token[], from: number, predicate: (token: Token) => boolean): number {
  for (let i = from; i < tokens.length; i++) if (tokens[i]!.type === 'open' && predicate(tokens[i]!)) return i;
  return -1;
}

/** The heading's number span and its remaining text, e.g. `Chapter 1` and `Introduzione`. */
function splitHeading(tokens: readonly Token[], heading: number): { tag: string; title: string } {
  const end = elementEnd(tokens, heading);
  const tagStart = findOpen(tokens, heading, (t) => hasClass(t, 'ltx_tag'));
  if (tagStart < 0 || tagStart > end) return { tag: '', title: decodeEntities(textOf(tokens, heading, end)).trim() };
  const tagEnd = elementEnd(tokens, tagStart);
  return {
    tag: decodeEntities(textOf(tokens, tagStart, tagEnd)).trim(),
    title: decodeEntities(textOf(tokens, tagEnd + 1, end)).replace(/\s+/g, ' ').trim(),
  };
}

function chapterBounds(tokens: readonly Token[]): { start: number; end: number } {
  const start = findOpen(tokens, 0, (t) => t.type === 'open' && t.name === 'section' && hasClass(t, 'ltx_chapter'));
  if (start < 0) throw new Error('no chapter (<section class="ltx_chapter">) found in the LaTeXML page');
  return { start, end: elementEnd(tokens, start) };
}

export function readChapterHead(page: string): ChapterHead {
  const tokens = tokenize(withoutScripts(page));
  const { start } = chapterBounds(tokens);
  const heading = findOpen(tokens, start, (t) => t.type === 'open' && t.name === 'h1');
  if (heading < 0) throw new Error('the chapter has no <h1> heading');
  const { tag, title } = splitHeading(tokens, heading);
  const numero = /\d+/.exec(tag)?.[0];
  if (numero === undefined || title === '') throw new Error(`cannot read the chapter number and title from "${tag} ${title}"`);
  return { numero: Number(numero), titolo: title };
}

function readVoce(tokens: readonly Token[], index: number, level: 'h2' | 'h3'): Voce | undefined {
  const id = attribute(tokens[index]!, 'id');
  const heading = findOpen(tokens, index, (t) => t.type === 'open' && t.name === level);
  if (id === undefined || heading < 0) return undefined;
  const { tag, title } = splitHeading(tokens, heading);
  return tag !== '' && title !== '' ? { id, numero: tag, titolo: title } : undefined;
}

function readSections(tokens: readonly Token[]): Sezione[] {
  const sezioni: Sezione[] = [];
  tokens.forEach((token, i) => {
    if (token.type !== 'open' || token.name !== 'section' || !hasClass(token, 'ltx_section')) return;
    const voce = readVoce(tokens, i, 'h2');
    if (!voce) return;
    const end = elementEnd(tokens, i);
    const sottosezioni: Voce[] = [];
    for (let j = i + 1; j < end; j++) {
      const inner = tokens[j]!;
      if (inner.type !== 'open' || inner.name !== 'section' || !hasClass(inner, 'ltx_subsection')) continue;
      const sub = readVoce(tokens, j, 'h3');
      if (sub) sottosezioni.push(sub);
    }
    sezioni.push({ ...voce, sottosezioni });
  });
  return sezioni;
}

/** Removes every element matching `predicate`, with its content. */
function dropElements(tokens: readonly Token[], predicate: (token: Token) => boolean): Token[] {
  const kept: Token[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.type === 'open' && predicate(token)) {
      i = elementEnd(tokens, i);
      continue;
    }
    kept.push(token);
  }
  return kept;
}

const isTcolorboxMarker = (token: Token): boolean =>
  token.type === 'open' && token.name === 'span' && hasClass(token, 'tcolorbox');

function tcolorboxTitlesOf(tokens: readonly Token[]): string[] {
  const titles: string[] = [];
  tokens.forEach((token, i) => {
    if (token.type === 'open' && token.name === 'p' && hasClass(token, 'tcbtitle')) {
      titles.push(decodeEntities(textOf(tokens, i, elementEnd(tokens, i))).replace(/\s+/g, ' ').trim());
    }
  });
  return titles;
}

/** `<p class="ltx_p">` and `<div class="ltx_para">` with nothing but blanks inside, e.g. what a removed marker leaves behind. */
function dropEmptyParagraphs(tokens: readonly Token[]): Token[] {
  const out: Token[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    const isParagraph = token.type === 'open' && ((token.name === 'p' && hasClass(token, 'ltx_p')) || (token.name === 'div' && hasClass(token, 'ltx_para')));
    if (token.type === 'open' && isParagraph) {
      const end = elementEnd(tokens, i);
      if (tokens.slice(i + 1, end).every((inner) => inner.type === 'text' && inner.raw.trim() === '')) {
        i = end;
        continue;
      }
    }
    out.push(token);
  }
  return out;
}

/** Replaces every element matching `predicate`, with its content, by `markup`. */
function replaceElements(tokens: readonly Token[], predicate: (token: Token) => boolean, markup: string): Token[] {
  const out: Token[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.type === 'open' && predicate(token)) {
      out.push({ type: 'other', raw: markup });
      i = elementEnd(tokens, i);
    } else {
      out.push(token);
    }
  }
  return out;
}

/**
 * A `lstlisting` becomes plain preformatted text: LaTeXML wraps every token in a colored,
 * inline-styled span (colors that ignore the theme) and adds copy/download buttons that run
 * JS and carry the code a second time as a data URI. Only the code text is kept. The block
 * scrolls sideways, so it takes focus: a keyboard user can scroll it (WCAG 2.1.1).
 */
function flattenCodeListings(tokens: readonly Token[]): Token[] {
  const out: Token[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.type !== 'open' || token.name !== 'div' || !hasClass(token, 'ltx_lstlisting') || !hasClass(token, 'ltx_listing')) {
      out.push(token);
      continue;
    }
    const end = elementEnd(tokens, i);
    const lines: string[] = [];
    for (let j = i + 1; j < end; j++) {
      const line = tokens[j]!;
      if (line.type !== 'open' || !hasClass(line, 'ltx_listingline')) continue;
      const lineEnd = elementEnd(tokens, j);
      const code = findOpen(tokens, j, (t) => t.type === 'open' && t.name === 'code');
      const codeEnd = code >= 0 && code < lineEnd ? elementEnd(tokens, code) : -1;
      lines.push(codeEnd < 0 ? '' : textOf(tokens, code, codeEnd).replace(/\r?\n/g, ''));
      j = lineEnd;
    }
    const body = lines.map((line) => `<span class="ltx_listingline">${line}</span>`).join('\n');
    out.push({ type: 'other', raw: `<pre class="listing" tabindex="0"><code>${body}</code></pre>` });
    i = end;
  }
  return out;
}

function rewriteHref(href: string, links: LinkTargets): string {
  if (href.startsWith('#') || /^(https?:|mailto:)/.test(href)) return href;
  const [file = '', hash] = href.split('#');
  const suffix = hash === undefined ? '' : `#${hash}`;
  if (file === 'index.html') return `/appunti/${links.corso}/${suffix}`;
  if (file === 'main.pdf') return `/appunti/${links.corso}/${links.corso}.pdf`;
  const slug = links.chapterSlugs[file];
  if (slug !== undefined) return `/appunti/${links.corso}/${slug}/${suffix}`;
  throw new Error(`cannot resolve the link "${href}": it points outside the converted chapters`);
}

export function processChapter(page: string, links: LinkTargets): ProcessedChapter {
  const all = tokenize(withoutScripts(page));
  const { start, end } = chapterBounds(all);
  const head = readChapterHead(page);

  let tokens = all.slice(start + 1, end);
  const heading = findOpen(tokens, 0, (t) => t.type === 'open' && t.name === 'h1');
  tokens = [...tokens.slice(0, heading), ...tokens.slice(elementEnd(tokens, heading) + 1)];

  const sezioni = readSections(tokens);

  const tcolorboxes = tokens.filter((t) => t.type === 'open' && isTcolorboxMarker(t)).length;
  const tcolorboxTitles = tcolorboxTitlesOf(tokens);
  tokens = dropElements(tokens, isTcolorboxMarker);
  tokens = dropEmptyParagraphs(tokens);
  tokens = replaceElements(tokens, (t) => t.type === 'open' && t.name === 'svg', FIGURE_PENDING);
  tokens = dropElements(tokens, (t) => t.type === 'open' && (t.name === 'button' || t.name === 'annotation' || hasClass(t, 'ltx_listing_data')));
  tokens = flattenCodeListings(tokens);

  let figurePending = tokens.filter((token) => token.raw === FIGURE_PENDING).length;
  tokens = tokens.map((token): Token => {
    if (token.type === 'text') return { ...token, raw: token.raw.replace(/​/g, '') };
    if (token.type !== 'open') return token;
    if (token.name === 'img') {
      figurePending++;
      return { type: 'other', raw: FIGURE_PENDING };
    }
    let next = removeAttribute(token, 'style');
    const href = token.name === 'a' ? attribute(token, 'href') : undefined;
    if (href !== undefined) next = setAttribute(next, 'href', rewriteHref(href, links));
    if (hasClass(token, 'ltx_eqn_eqno') && attribute(token, 'id') === undefined) next = setAttribute(next, 'aria-hidden', 'true');
    return next;
  });

  const html = serialize(tokens).trim();
  return { ...head, sezioni, html, hasMath: /<math[\s>]/.test(html), figurePending, tcolorboxes, tcolorboxTitles };
}
