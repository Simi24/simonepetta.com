import type { IncomingMessage, ServerResponse } from 'node:http';
import { LetturaSchemaError } from '../../schemas/lettura.ts';
import { readJsonBody, respondJson } from './http.ts';
import { saveLettura } from './save.ts';

interface SavePayload {
  slug?: string;
  data?: unknown;
  testo?: string;
  expectedVersion?: string;
}

export interface SaveHandlerOptions {
  contentDir: string;
  /** Called after a file is written, so the caller can refresh the content collection. */
  onSaved?: (result: { slug: string }) => Promise<void> | void;
}

/**
 * The dev-server save handler (SPEC.md §6.4): validates with the shared schema, writes the file,
 * and reports per-field messages on an invalid payload without writing anything.
 */
export function createSaveHandler({ contentDir, onSaved }: SaveHandlerOptions) {
  return async function handleSave(req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void): Promise<void> {
    if (req.method !== 'POST') {
      next();
      return;
    }
    let result;
    try {
      const { slug, data, testo, expectedVersion } = await readJsonBody<SavePayload>(req);
      result = saveLettura({ contentDir, slug, input: data, testo, expectedVersion });
    } catch (error) {
      if (error instanceof LetturaSchemaError) {
        respondJson(res, 400, { issues: error.issues });
        return;
      }
      respondJson(res, 500, { issues: [error instanceof Error ? error.message : String(error)] });
      return;
    }
    // The file is already written at this point: a failure from here on (refreshing the content
    // collection) must not read as "the save failed" and invite a duplicate save — it's reported
    // as a warning on an otherwise-successful response.
    try {
      await onSaved?.(result);
      respondJson(res, 200, { slug: result.slug });
    } catch (error) {
      respondJson(res, 200, {
        slug: result.slug,
        warning: `salvato, ma l'aggiornamento del contenuto è fallito: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  };
}
