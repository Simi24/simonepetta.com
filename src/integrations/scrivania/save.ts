import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLettura, type Lettura } from '../../schemas/lettura.ts';

/** Strips diacritics and punctuation the same way for a title or an author's surname. */
function slugPart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Kebab-case of the title (SPEC.md §6.1). */
export function slugify(titolo: string): string {
  return slugPart(titolo);
}

function authorSurname(autore: string): string {
  const words = autore.trim().split(/\s+/);
  return words[words.length - 1] ?? autore;
}

function existingSlugs(contentDir: string): Set<string> {
  if (!existsSync(contentDir)) return new Set();
  return new Set(
    readdirSync(contentDir)
      .filter((file) => file.endsWith('.md'))
      .map((file) => file.slice(0, -'.md'.length)),
  );
}

/** Kebab-case of the title, the author's surname appended on collision (SPEC.md §6.1). */
export function slugFor(titolo: string, autore: string, taken: ReadonlySet<string>): string {
  const base = slugify(titolo);
  return taken.has(base) ? `${base}-${slugPart(authorSurname(autore))}` : base;
}

function quoted(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

/** Frontmatter + body, dates quoted ISO (SPEC.md §6.1 requires this of the writing desk). */
export function serializeLettura(data: Lettura, body: string): string {
  const lines = ['---', `titolo: ${quoted(data.titolo)}`, `autore: ${quoted(data.autore)}`];
  if (data.anno_opera !== undefined) lines.push(`anno_opera: ${data.anno_opera}`);
  lines.push(`stato: ${data.stato}`);
  if (data.iniziato !== undefined) lines.push(`iniziato: ${quoted(data.iniziato)}`);
  if (data.finito !== undefined) lines.push(`finito: ${quoted(data.finito)}`);
  if (data.voto !== undefined) lines.push(`voto: ${data.voto}`);
  if (data.pagine !== undefined) lines.push(`pagine: ${data.pagine}`);
  if (data.nota !== undefined) lines.push(`nota: ${quoted(data.nota)}`);
  lines.push('---');
  const body_ = body.trim();
  return `${lines.join('\n')}\n${body_ ? `\n${body_}\n` : ''}`;
}

export interface SaveParams {
  contentDir: string;
  /** The existing entry's slug, when editing. Absent for a new book. */
  slug?: string | undefined;
  input: unknown;
}

export interface SaveResult {
  slug: string;
  path: string;
}

/**
 * Validates with `parseLettura` (throws `LetturaSchemaError`, unchanged, on invalid input: no file
 * is written) and writes the book's file. A new book gets a fresh slug (SPEC.md §6.1); an edit
 * keeps the file name it was given and never touches the body that follows the frontmatter.
 */
export function saveLettura({ contentDir, slug, input }: SaveParams): SaveResult {
  const lettura = parseLettura(input);
  mkdirSync(contentDir, { recursive: true });
  const finalSlug = slug ?? slugFor(lettura.titolo, lettura.autore, existingSlugs(contentDir));
  const path = join(contentDir, `${finalSlug}.md`);
  const body = slug !== undefined && existsSync(path) ? readBody(path) : '';
  writeFileSync(path, serializeLettura(lettura, body));
  return { slug: finalSlug, path };
}

function readBody(path: string): string {
  const raw = readFileSync(path, 'utf8');
  const match = /^---\n[\s\S]*?\n---\n([\s\S]*)$/.exec(raw);
  return match?.[1] ?? '';
}
