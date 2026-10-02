/** The body of a save request, as the client sends it and the dev-server handler reads it (SPEC.md §6.4). */
export interface SavePayload {
  /** The existing entry's id. Absent for a new book. */
  slug?: string | undefined;
  /** The existing entry's file name when it is not `<slug>.md` (a hand-made one). */
  file?: string | undefined;
  data: unknown;
  /** The sheet's draft; absent for a metadata-only save. */
  testo?: string | undefined;
  /** The file's `fileVersion` as the page loaded it; sent with `testo` only. */
  expectedVersion?: string | undefined;
  /** Chosen by the page before saving; echoed back by `GET`, so the saved view is only drawn for the save that asked for it. */
  saveId?: string | undefined;
}

/** What the dev server wrote on a save: the saved view's content (SPEC.md §6.4). */
export interface SavedFile {
  slug: string;
  /** Relative to the repo, as the author would type it into `git add`. */
  path: string;
  contents: string;
  saveId?: string | undefined;
}

/** The body of a preview request: the sheet's current draft. */
export interface PreviewPayload {
  data: unknown;
  testo: string;
}
