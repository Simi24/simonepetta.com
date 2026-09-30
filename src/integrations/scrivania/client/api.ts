export interface SaveOk {
  ok: true;
  slug: string;
}

export interface SaveErr {
  ok: false;
  issues: string[];
}

export type SaveResponse = SaveOk | SaveErr;

/** Posts a book's frontmatter to the dev-server save handler (SPEC.md §6.4). */
export async function postSave(
  savePath: string,
  payload: { slug?: string | undefined; data: Record<string, unknown> },
): Promise<SaveResponse> {
  let res: Response;
  try {
    res = await fetch(savePath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, issues: ['il server di sviluppo non risponde'] };
  }
  const body = (await res.json().catch(() => ({}))) as { slug?: string; issues?: string[] };
  if (res.ok && body.slug) return { ok: true, slug: body.slug };
  return { ok: false, issues: body.issues ?? [`errore HTTP ${res.status}`] };
}
