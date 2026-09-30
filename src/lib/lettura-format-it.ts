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
