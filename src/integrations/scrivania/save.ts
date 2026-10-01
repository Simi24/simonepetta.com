import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LetturaSchemaError, parseLettura, type Lettura } from '../../schemas/lettura.ts';
import { fileVersion } from './version.ts';

const KEBAB_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

/**
 * Kebab-case of the title, the author's surname appended on collision (SPEC.md §6.1). Throws
 * when neither candidate is usable: the title has no ASCII letters or digits to slugify, or both
 * the base slug and the surname variant are already taken.
 */
function pickCreateSlug(titolo: string, autore: string, taken: ReadonlySet<string>): string {
  const base = slugPart(titolo);
  if (base !== '' && !taken.has(base)) return base;
  const withSurname = base === '' ? slugPart(authorSurname(autore)) : `${base}-${slugPart(authorSurname(autore))}`;
  if (withSurname !== '' && !taken.has(withSurname)) return withSurname;
  throw new LetturaSchemaError([
    'il campo "titolo": non è possibile generare uno slug libero (titolo non slugificabile o già in uso)',
  ]);
}

/** Serializes a value as a valid double-quoted YAML scalar: `JSON.stringify` escapes exactly the characters YAML also needs escaped. */
function quoted(value: string): string {
  return JSON.stringify(value);
}

/** Frontmatter + body, dates quoted ISO (SPEC.md §6.1 requires this of the writing desk). The body is appended byte for byte: never trimmed. */
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
  return `${lines.join('\n')}\n${body}`;
}

export interface SaveParams {
  contentDir: string;
  /** The existing entry's slug, when editing. Absent for a new book. */
  slug?: string | undefined;
  input: unknown;
  /**
   * The writing sheet's current draft (SPEC.md §6.4): when given, it replaces the body outright
   * (trimmed; blank stays blank). When absent, a metadata-only edit preserves the existing body
   * exactly — the sheet never sends this field for those saves.
   */
  testo?: string | undefined;
  /**
   * The `fileVersion` of the file as the sheet's page loaded it. Checked only alongside `testo`:
   * a metadata-only edit doesn't touch the body a stale version would protect. When the file's
   * current version no longer matches, the save is rejected as a conflict and nothing is written,
   * rather than silently overwriting a change made since the page was generated.
   */
  expectedVersion?: string | undefined;
}

export interface SaveResult {
  slug: string;
  path: string;
  titolo: string;
  stato: string;
}

/** The body as the writing sheet's text becomes on disk: a blank line after the frontmatter, the text trimmed, a trailing newline — empty when there's nothing to say. */
function formatTesto(testo: string): string {
  const trimmed = testo.trim();
  return trimmed === '' ? '' : `\n${trimmed}\n`;
}

/**
 * Validates with `parseLettura` (throws `LetturaSchemaError`, unchanged, on invalid input: no file
 * is written) and writes the book's file. A new book gets a fresh, exclusively-created slug
 * (SPEC.md §6.1; never overwrites); an edit keeps the file name it was given — validated as an
 * existing, kebab-case slug so it can't escape `contentDir`. Metadata-only edits (no `testo`)
 * never touch the body that follows the frontmatter; the writing sheet's edits (`testo` given)
 * replace it outright, without needing to read — or recognize — whatever body was there before.
 */
export function saveLettura({ contentDir, slug, input, testo, expectedVersion }: SaveParams): SaveResult {
  const lettura = parseLettura(input);
  mkdirSync(contentDir, { recursive: true });

  if (slug === undefined) {
    const finalSlug = pickCreateSlug(lettura.titolo, lettura.autore, existingSlugs(contentDir));
    const path = join(contentDir, `${finalSlug}.md`);
    try {
      // 'wx': exclusive create, defense in depth against a slug that (despite the check above)
      // turns out to already exist — a create must never overwrite a file.
      writeFileSync(path, serializeLettura(lettura, ''), { flag: 'wx' });
    } catch (error) {
      if (isNodeError(error) && error.code === 'EEXIST') {
        throw new LetturaSchemaError([`il campo "titolo": esiste già un libro con lo slug "${finalSlug}"`]);
      }
      throw error;
    }
    return { slug: finalSlug, path, titolo: lettura.titolo, stato: lettura.stato };
  }

  if (!KEBAB_SLUG_RE.test(slug)) {
    throw new LetturaSchemaError([`il campo "slug": "${slug}" non è in kebab-case`]);
  }
  const path = join(contentDir, `${slug}.md`);
  if (!existsSync(path)) {
    throw new LetturaSchemaError([`il campo "slug": nessun libro con lo slug "${slug}"`]);
  }
  if (testo !== undefined && expectedVersion !== undefined && fileVersion(readFileSync(path)) !== expectedVersion) {
    throw new LetturaSchemaError(['il file è cambiato nel frattempo: ricarica la pagina e riprova']);
  }
  const body = testo !== undefined ? formatTesto(testo) : readBody(path);
  writeFileSync(path, serializeLettura(lettura, body));
  return { slug, path, titolo: lettura.titolo, stato: lettura.stato };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

// Matches this module's own `serializeLettura` output exactly: opening "---", a frontmatter block,
// a closing "---" whose line holds nothing else (so a stray trailing space fails the match rather
// than silently becoming part of the body), then the body untouched. Tolerates a leading BOM and
// CRLF line endings — both of which Astro's own loader accepts — since a hand-edited or
// foreign-tool-saved file can carry either.
const FRONTMATTER_RE = /^\uFEFF?---(?:\r\n|\n)([\s\S]*?)(?:\r\n|\n)---(?=\r\n|\n|$)(?:\r\n|\n)?([\s\S]*)$/;

/**
 * Extracts the body that follows an existing file's frontmatter. Throws, rather than guessing,
 * when the frontmatter can't be recognized: a metadata-only edit must never silently drop text
 * the loader itself would have accepted some other way.
 */
function readBody(path: string): string {
  const raw = readFileSync(path, 'utf8');
  const match = FRONTMATTER_RE.exec(raw);
  if (!match) {
    throw new LetturaSchemaError([`il campo "slug": il file esistente ha un frontmatter che non riesco a leggere`]);
  }
  return match[2] ?? '';
}
