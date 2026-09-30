/** Formats an ISO date (`YYYY-MM-DD`) as RFC 822 at midnight UTC, for an RSS `pubDate` (SPEC.md §6.5). */
export function toRfc822(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toUTCString();
}
