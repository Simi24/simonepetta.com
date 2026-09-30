const DEFAULT_PAGINE = 250;
const MIN_SPINE_PAGINE = 80;
const MAX_SPINE_PAGINE = 1000;
const TINT_COUNT = 5;
const TITLE_TRUNCATE_AT = 34;
const TITLE_TRUNCATE_TO = 32;

/** Pages used to size a spine, clamped for display (SPEC.md §6.1). */
export function spinePagine(pagine: number | undefined): number {
  const pages = pagine ?? DEFAULT_PAGINE;
  return Math.min(MAX_SPINE_PAGINE, Math.max(MIN_SPINE_PAGINE, pages));
}

/** Rounds to 3 decimal places, clear of the binary floating-point noise `pagine / 80` etc. can leave behind. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Spine height in rem, following the prototype's `8 + pagine/80` (docs/prototype/visual.html:438). */
export function spineHeightRem(pagine: number | undefined): number {
  return round(8 + spinePagine(pagine) / 80);
}

/** Spine width in rem, following the prototype's `2.1 + pagine/400` (docs/prototype/visual.html:438). */
export function spineWidthRem(pagine: number | undefined): number {
  return round(2.1 + spinePagine(pagine) / 400);
}

/** Deterministic tint (1..5) for a book, hashed from its slug so it never reshuffles when others are added (SPEC.md §5.1). */
export function tintForSlug(slug: string): number {
  let hash = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    hash ^= slug.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % TINT_COUNT) + 1;
}

/** Truncates a spine's title as the prototype does (docs/prototype/visual.html:439). */
export function truncateTitle(titolo: string): string {
  return titolo.length > TITLE_TRUNCATE_AT ? `${titolo.slice(0, TITLE_TRUNCATE_TO)}…` : titolo;
}
