export type StatoLettura = 'in-corso' | 'letto' | 'abbandonato';

export interface Lettura {
  titolo: string;
  autore: string;
  stato: StatoLettura;
  anno_opera?: number;
  iniziato?: string;
  finito?: string;
  voto?: number;
  pagine?: number;
  nota?: string;
}

/** Raised when a book's frontmatter breaks a rule in SPEC.md §6.1. */
export class LetturaSchemaError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(issues.join('; '));
    this.name = 'LetturaSchemaError';
    this.issues = issues;
  }
}

const STATI: readonly StatoLettura[] = ['in-corso', 'letto', 'abbandonato'];

const KNOWN_FIELDS: readonly string[] = [
  'titolo',
  'autore',
  'anno_opera',
  'stato',
  'iniziato',
  'finito',
  'voto',
  'pagine',
  'nota',
];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Normalizes a date field to `YYYY-MM-DD`, accepting both a quoted string and the `Date` YAML parses an unquoted date into. */
function toIsoDate(value: unknown): string | undefined {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string' && DATE_PATTERN.test(value)) {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return undefined;
    return value;
  }
  return undefined;
}

function readRequiredString(data: Record<string, unknown>, field: string, issues: string[]): string | undefined {
  const value = data[field];
  if (value === undefined) {
    issues.push(`"${field}" è obbligatorio`);
    return undefined;
  }
  if (typeof value !== 'string' || value.trim() === '') {
    issues.push(`"${field}" deve essere una stringa non vuota`);
    return undefined;
  }
  return value;
}

function readOptionalString(data: Record<string, unknown>, field: string, issues: string[]): string | undefined {
  const value = data[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim() === '') {
    issues.push(`"${field}" deve essere una stringa non vuota`);
    return undefined;
  }
  return value;
}

function readStato(data: Record<string, unknown>, issues: string[]): StatoLettura | undefined {
  const value = data['stato'];
  if (value === undefined) {
    issues.push('"stato" è obbligatorio');
    return undefined;
  }
  if (typeof value !== 'string' || !STATI.includes(value as StatoLettura)) {
    issues.push(`"stato" deve essere uno tra ${STATI.join(', ')}`);
    return undefined;
  }
  return value as StatoLettura;
}

function readOptionalPositiveInteger(data: Record<string, unknown>, field: string, issues: string[]): number | undefined {
  const value = data[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    issues.push(`"${field}" deve essere un numero intero positivo`);
    return undefined;
  }
  return value;
}

function readOptionalDate(data: Record<string, unknown>, field: string, issues: string[]): string | undefined {
  const value = data[field];
  if (value === undefined) return undefined;
  const iso = toIsoDate(value);
  if (iso === undefined) {
    issues.push(`"${field}" deve essere una data valida (YYYY-MM-DD)`);
    return undefined;
  }
  return iso;
}

function readOptionalVoto(data: Record<string, unknown>, issues: string[]): number | undefined {
  const value = data['voto'];
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || value < 1 || value > 5 || !Number.isInteger(value * 2)) {
    issues.push('"voto" deve essere un numero tra 1 e 5, a step di 0,5');
    return undefined;
  }
  return value;
}

/**
 * Validates a book's frontmatter against SPEC.md §6.1. Strict: unknown keys fail.
 * Shared by the content collection and the writing desk (SPEC.md §6.4).
 */
export function parseLettura(input: unknown): Lettura {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new LetturaSchemaError(['il frontmatter deve essere un oggetto']);
  }
  const data = input as Record<string, unknown>;
  const issues: string[] = [];

  for (const key of Object.keys(data)) {
    if (!KNOWN_FIELDS.includes(key)) {
      issues.push(`campo sconosciuto: "${key}"`);
    }
  }

  const titolo = readRequiredString(data, 'titolo', issues);
  const autore = readRequiredString(data, 'autore', issues);
  const stato = readStato(data, issues);
  const anno_opera = readOptionalPositiveInteger(data, 'anno_opera', issues);
  const iniziato = readOptionalDate(data, 'iniziato', issues);
  const finito = readOptionalDate(data, 'finito', issues);
  const voto = readOptionalVoto(data, issues);
  const pagine = readOptionalPositiveInteger(data, 'pagine', issues);
  const nota = readOptionalString(data, 'nota', issues);

  if (stato === 'letto' && data['finito'] === undefined) {
    issues.push('"finito" è obbligatorio per stato "letto"');
  }
  if (stato === 'in-corso' && data['finito'] !== undefined) {
    issues.push('"finito" non è ammesso per stato "in-corso"');
  }
  if (stato === 'in-corso' && data['voto'] !== undefined) {
    issues.push('"voto" non è ammesso per stato "in-corso"');
  }

  if (issues.length > 0) {
    throw new LetturaSchemaError(issues);
  }

  return {
    titolo: titolo!,
    autore: autore!,
    stato: stato!,
    ...(anno_opera !== undefined ? { anno_opera } : {}),
    ...(iniziato !== undefined ? { iniziato } : {}),
    ...(finito !== undefined ? { finito } : {}),
    ...(voto !== undefined ? { voto } : {}),
    ...(pagine !== undefined ? { pagine } : {}),
    ...(nota !== undefined ? { nota } : {}),
  };
}
