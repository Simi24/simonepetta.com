const TINT_COUNT = 5;
const DEFAULT_PAGINE = 250;
const MIN_SPINE_PAGINE = 80;
const MAX_SPINE_PAGINE = 1000;

/** Deterministic tint (1..5) for a book, hashed from its slug so it never reshuffles when others are added (SPEC.md §5.1). */
export function tintForSlug(slug: string): number {
  let hash = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    hash ^= slug.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % TINT_COUNT) + 1;
}

/** Pages used to size a spine, clamped for display (SPEC.md §6.1). */
export function spinePagine(pagine: number | undefined): number {
  const pages = pagine ?? DEFAULT_PAGINE;
  return Math.min(MAX_SPINE_PAGINE, Math.max(MIN_SPINE_PAGINE, pages));
}

const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'] as const;

/** Formats an ISO date (`YYYY-MM-DD`) the Italian way, e.g. "2 set 2026". */
export function formatDataIt(iso: string): string {
  const [year, month, day] = iso.split('-') as [string, string, string];
  const monthName = MESI[Number(month) - 1] ?? '';
  return `${Number(day)} ${monthName} ${year}`;
}

/** Formats a grade with an Italian decimal comma, e.g. "3,5". */
export function formatVoto(voto: number): string {
  return Number.isInteger(voto) ? String(voto) : voto.toFixed(1).replace('.', ',');
}
