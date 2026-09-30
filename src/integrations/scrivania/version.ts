import { createHash } from 'node:crypto';

/**
 * A content fingerprint for stale-overwrite detection (SPEC.md §6.4: never silently lose the
 * author's text). The sheet embeds a book's `fileVersion` when the page is generated; a save that
 * writes a new body sends it back, so the save module can tell a concurrent change apart from the
 * page simply being stale.
 */
export function fileVersion(contents: Buffer | string): string {
  return createHash('sha256').update(contents).digest('hex');
}
