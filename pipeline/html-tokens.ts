/**
 * A small tokenizer for LaTeXML's output, which is regular, well-formed HTML5. It only ever
 * splits and re-joins the source text, so whatever a pass does not touch is kept byte for byte.
 * No dependency: the pipeline's post-processing does not justify an HTML parser.
 */

export type Token =
  | { type: 'open'; name: string; raw: string }
  | { type: 'close'; name: string; raw: string }
  | { type: 'text'; raw: string }
  | { type: 'other'; raw: string };

const VOID_ELEMENTS = new Set(['img', 'br', 'hr', 'link', 'meta', 'input', 'area', 'base', 'col', 'source', 'wbr']);

const TOKEN = /<!--[\s\S]*?-->|<!doctype[^>]*>|<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|[^<]+|</gi;

export function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  for (const match of html.matchAll(TOKEN)) {
    const [raw, slash, name] = match;
    if (name === undefined) {
      tokens.push(raw.startsWith('<') && raw.length > 1 ? { type: 'other', raw } : { type: 'text', raw });
    } else {
      tokens.push(slash ? { type: 'close', name: name.toLowerCase(), raw } : { type: 'open', name: name.toLowerCase(), raw });
    }
  }
  return tokens;
}

export const serialize = (tokens: readonly Token[]): string => tokens.map((token) => token.raw).join('');

/** Whether an open tag has no matching close tag. */
export const isVoid = (token: Token): boolean =>
  token.type === 'open' && (VOID_ELEMENTS.has(token.name) || token.raw.endsWith('/>'));

/** Index of the close tag matching the open tag at `start`. Throws on unbalanced input. */
export function elementEnd(tokens: readonly Token[], start: number): number {
  const open = tokens[start];
  if (open?.type !== 'open') throw new Error(`token ${start} is not an open tag`);
  if (isVoid(open)) return start;
  let depth = 0;
  for (let i = start; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.type === 'open' && token.name === open.name && !isVoid(token)) depth++;
    if (token.type === 'close' && token.name === open.name && --depth === 0) return i;
  }
  throw new Error(`<${open.name}> at token ${start} is never closed`);
}

export function attribute(token: Token, name: string): string | undefined {
  if (token.type !== 'open') return undefined;
  return new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)')`).exec(token.raw)?.slice(1).find((value) => value !== undefined);
}

export const classes = (token: Token): string[] => attribute(token, 'class')?.split(/\s+/).filter(Boolean) ?? [];

export const hasClass = (token: Token, name: string): boolean => classes(token).includes(name);

export function removeAttribute(token: Token, name: string): Token {
  if (token.type !== 'open') return token;
  return { ...token, raw: token.raw.replace(new RegExp(`\\s${name}=(?:"[^"]*"|'[^']*')`), '') };
}

export function setAttribute(token: Token, name: string, value: string): Token {
  if (token.type !== 'open') return token;
  const without = removeAttribute(token, name);
  const closing = without.raw.endsWith('/>') ? '/>' : '>';
  return { ...without, raw: `${without.raw.slice(0, -closing.length)} ${name}="${value}"${closing}` };
}

/** The text content between `start` and `end` (inclusive), tags dropped. Entities are left encoded. */
export function textOf(tokens: readonly Token[], start: number, end: number): string {
  return tokens
    .slice(start, end + 1)
    .filter((token) => token.type === 'text')
    .map((token) => token.raw)
    .join('');
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export const decodeEntities = (text: string): string =>
  text.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (whole, dec?: string, hex?: string, name?: string) => {
    if (dec !== undefined) return String.fromCodePoint(Number(dec));
    if (hex !== undefined) return String.fromCodePoint(parseInt(hex, 16));
    return (name && ENTITIES[name.toLowerCase()]) || whole;
  });
