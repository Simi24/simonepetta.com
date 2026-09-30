/** Cloudflare's per-file cap (SPEC.md §7.2): a build check, not a runtime one. */
export const PDF_CAP_BYTES = 25 * 1024 * 1024;

/** Throws when a course's PDF is over the cap, failing the build rather than shipping it. */
export function assertPdfSize(bytes: number, label: string): void {
  if (bytes > PDF_CAP_BYTES) {
    throw new Error(`${label}: PDF is ${bytes} B, over the ${PDF_CAP_BYTES} B (25 MiB) cap (SPEC.md §7.2)`);
  }
}
