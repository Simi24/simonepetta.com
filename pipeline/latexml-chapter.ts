import {
  attribute,
  decodeEntities,
  elementEnd,
  classes,
  hasClass,
  removeAttribute,
  serialize,
  setAttribute,
  textOf,
  tokenize,
  type Token,
} from './html-tokens.ts';
import { NO_FIGURES, rasterTag, tikzSvg, type FigureAssets } from './figures.ts';

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
  /** How many of the compiled TikZ pictures this chapter took, in order (the next chapter starts after them). */
  tikzUsed: number;
  /** How many tcolorbox environments the stand-in binding marked (the markers are removed from `html`). */
  tcolorboxes: number;
  /** The plain text of each tcolorbox `title=`, which stays in `html` as a heading. */
  tcolorboxTitles: string[];
}

const withoutScripts = (html: string): string => html.replace(/<script\b[\s\S]*?<\/script>/gi, '');

function findOpen(tokens: readonly Token[], from: number, predicate: (token: Token) => boolean): number {
  for (let i = from; i < tokens.length; i++) if (tokens[i]!.type === 'open' && predicate(tokens[i]!)) return i;
  return -1;
}

/** The text of a heading: the math's own symbols once (not its TeX annotation), without invisible operators. */
function headingText(tokens: readonly Token[], start: number, end: number): string {
  const visible: Token[] = [];
  for (let i = start; i <= end; i++) {
    const token = tokens[i]!;
    if (token.type === 'open' && token.name === 'annotation') i = elementEnd(tokens, i);
    else visible.push(token);
  }
  return decodeEntities(textOf(visible, 0, visible.length - 1)).replace(/[\u2061-\u2064]/g, '');
}

/** The heading's number span and its remaining text, e.g. `Chapter 1` and `Introduzione`. */
function splitHeading(tokens: readonly Token[], heading: number): { tag: string; title: string } {
  const end = elementEnd(tokens, heading);
  const tagStart = findOpen(tokens, heading, (t) => hasClass(t, 'ltx_tag'));
  if (tagStart < 0 || tagStart > end) return { tag: '', title: headingText(tokens, heading, end).trim() };
  const tagEnd = elementEnd(tokens, tagStart);
  return {
    tag: decodeEntities(textOf(tokens, tagStart, tagEnd)).trim(),
    title: headingText(tokens, tagEnd + 1, end).replace(/\s+/g, ' ').trim(),
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

/** Replaces every element matching `predicate`, with its content, by what `markup` returns for it (in order). */
function replaceElements(tokens: readonly Token[], predicate: (token: Token) => boolean, markup: (index: number) => string): Token[] {
  const out: Token[] = [];
  let index = 0;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.type === 'open' && predicate(token)) {
      out.push({ type: 'other', raw: markup(index++) });
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

/**
 * LaTeXML numbers every line of an algorithm, including the empty ones that only draw the
 * rules closing a block; algorithm2e (the PDF) does not. Those lines lose their number and
 * the others are counted again from 1 in each algorithm.
 */
function renumberAlgorithmLines(tokens: readonly Token[]): Token[] {
  const out = [...tokens];
  let next = 1;
  for (let i = 0; i < out.length; i++) {
    const token = out[i]!;
    if (token.type !== 'open' || token.name !== 'div') continue;
    if (hasClass(token, 'ltx_listing')) next = 1;
    if (!hasClass(token, 'ltx_listingline')) continue;
    const end = elementEnd(out, i);
    const tag = findOpen(out, i, (t) => hasClass(t, 'ltx_tag_listingline'));
    if (tag < 0 || tag > end) continue;
    const tagEnd = elementEnd(out, tag);
    const hasContent = out.slice(tagEnd + 1, end).some((t) => (t.type === 'text' && t.raw.trim() !== '') || (t.type === 'open' && t.name !== 'code' && !hasClass(t, 'ltx_rule')));
    if (hasContent) out[tag + 1] = { type: 'text', raw: String(next++) };
    else out.splice(tag, tagEnd - tag + 1);
  }
  return out;
}

/** Listing captions say "Listing 3: "; the PDF numbers them per chapter, "Listing 7.3: ". */
function numberListingsPerChapter(tokens: readonly Token[], chapter: number): Token[] {
  let count = 0;
  return tokens.map((token, i): Token => {
    const open = tokens[i - 1];
    if (token.type !== 'text' || open?.type !== 'open' || !hasClass(open, 'ltx_tag_float') || !/^Listing\s\d+:/.test(token.raw)) return token;
    return { ...token, raw: token.raw.replace(/^(Listing\s)\d+:/, `$1${chapter}.${++count}:`) };
  });
}

/**
 * LaTeXML puts `tabular`s next to inline math inside one `<p>`, which is invalid (a table
 * closes the paragraph, so the browser stacks them vertically). Such a paragraph becomes a
 * `div` that lays its children out on one line. LaTeXML also hoists the paragraph's first
 * table into a `bml-overflow-wrapper` just before the `<p>`: it is moved back in.
 */
const isOpenDiv = (token: Token): boolean => token.type === 'open' && token.name === 'div';

function keepTabularsOnOneLine(tokens: readonly Token[]): Token[] {
  const out: Token[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    const end = token.type === 'open' && token.name === 'p' ? elementEnd(tokens, i) : -1;
    if (end < 0 || !tokens.slice(i, end).some((t) => t.type === 'open' && t.name === 'table')) {
      out.push(token);
      continue;
    }
    let hoisted: Token[] = [];
    let before = out.length - 1;
    while (before >= 0 && out[before]!.type === 'text' && out[before]!.raw.trim() === '') before--;
    const last = out[before];
    if (last?.type === 'close' && last.name === 'div') {
      let wrapper = before;
      while (wrapper >= 0 && !isOpenDiv(out[wrapper]!)) wrapper--;
      if (wrapper >= 0 && hasClass(out[wrapper]!, 'bml-overflow-wrapper')) {
        hoisted = out.slice(wrapper + 1, before);
        out.length = wrapper;
      }
    }
    const classNames = [...classes(token), 'ltx_inline_tabulars'].join(' ');
    out.push({ type: 'open', name: 'div', raw: `<div class="${classNames}">` }, ...hoisted, ...tokens.slice(i + 1, end), { type: 'close', name: 'div', raw: '</div>' });
    i = end;
  }
  return out;
}

/**
 * A display equation scrolls sideways when it is wider than the page (CSS), and a scrolling
 * region must be reachable with the keyboard. Width is not known here, so the equations long
 * enough to overflow a narrow screen (by their visible symbols) get a tab stop; short ones do not.
 */
const WIDE_MATH_SYMBOLS = 30;
const SYMBOL = /<(mi|mn|mo|mtext)\b[^>]*>([^<]*)<\/\1>/g;

function makeWideMathFocusable(tokens: readonly Token[]): Token[] {
  return tokens.map((token, i): Token => {
    if (token.type !== 'open' || token.name !== 'math' || attribute(token, 'display') !== 'block') return token;
    const math = serialize(tokens.slice(i, elementEnd(tokens, i)));
    const symbols = [...math.matchAll(SYMBOL)].filter(([, , text]) => !/^[\u2061-\u2064]*$/.test(text ?? '')).length;
    return symbols >= WIDE_MATH_SYMBOLS ? setAttribute(token, 'tabindex', '0') : token;
  });
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

export function processChapter(page: string, links: LinkTargets, figures: FigureAssets = NO_FIGURES): ProcessedChapter {
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
  let tikzUsed = 0;
  tokens = replaceElements(tokens, (t) => t.type === 'open' && t.name === 'svg', (index) => {
    const tikz = figures.tikz[index];
    if (tikz === undefined) throw new Error('the chapter has more TikZ pictures than were compiled to SVG');
    tikzUsed = index + 1;
    return tikzSvg(tikz, figures.alt[tikz.key] ?? '');
  });
  tokens = dropElements(tokens, (t) => t.type === 'open' && (t.name === 'button' || t.name === 'annotation' || hasClass(t, 'ltx_listing_data')));
  tokens = flattenCodeListings(tokens);
  tokens = renumberAlgorithmLines(tokens);
  tokens = numberListingsPerChapter(tokens, head.numero);
  tokens = keepTabularsOnOneLine(tokens);
  tokens = makeWideMathFocusable(tokens);

  tokens = tokens.map((token): Token => {
    if (token.type === 'text') return { ...token, raw: token.raw.replace(/​/g, '') };
    if (token.type !== 'open') return token;
    if (token.name === 'img') return { type: 'other', raw: rasterTag(links.corso, attribute(token, 'src') ?? '', figures) };
    let next = removeAttribute(token, 'style');
    const href = token.name === 'a' ? attribute(token, 'href') : undefined;
    if (href !== undefined) next = setAttribute(next, 'href', rewriteHref(href, links));
    if (hasClass(token, 'ltx_eqn_eqno') && attribute(token, 'id') === undefined) next = setAttribute(next, 'aria-hidden', 'true');
    return next;
  });

  const html = serialize(tokens).trim();
  return { ...head, sezioni, html, hasMath: /<math[\s>]/.test(html), tikzUsed, tcolorboxes, tcolorboxTitles };
}
