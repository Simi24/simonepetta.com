import type { PreviewPayload, SavePayload } from '../payload.ts';

export interface SaveOk {
  ok: true;
  slug: string;
  /** Set when the file was written but refreshing the content collection failed (SPEC.md §6.4): not an error, but not silently droppable either. */
  warning?: string | undefined;
}

export interface SaveErr {
  ok: false;
  issues: string[];
}

export type SaveResponse = SaveOk | SaveErr;

const UNREACHABLE: SaveErr = { ok: false, issues: ['il server di sviluppo non risponde'] };

async function postJson(path: string, payload: SavePayload | PreviewPayload): Promise<Response | undefined> {
  try {
    return await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  } catch {
    return undefined;
  }
}

/** Posts a book's frontmatter (and, from the writing sheet, its body) to the dev-server save handler (SPEC.md §6.4). */
export async function postSave(savePath: string, payload: SavePayload): Promise<SaveResponse> {
  const res = await postJson(savePath, payload);
  if (res === undefined) return UNREACHABLE;
  const body = (await res.json().catch(() => ({}))) as { slug?: string; issues?: string[]; warning?: string };
  if (res.ok && body.slug) return { ok: true, slug: body.slug, warning: body.warning };
  return { ok: false, issues: body.issues ?? [`errore HTTP ${res.status}`] };
}

export interface PreviewOk {
  ok: true;
  html: string;
}

export type PreviewResponse = PreviewOk | SaveErr;

/** Asks the dev server to render the sheet's current draft with the real `Post` component (SPEC.md §6.4). */
export async function postPreview(previewPath: string, payload: PreviewPayload): Promise<PreviewResponse> {
  const res = await postJson(previewPath, payload);
  if (res === undefined) return UNREACHABLE;
  const body = (await res.json().catch(() => ({}))) as { html?: string; issues?: string[] };
  if (res.ok && typeof body.html === 'string') return { ok: true, html: body.html };
  return { ok: false, issues: body.issues ?? [`errore HTTP ${res.status}`] };
}
