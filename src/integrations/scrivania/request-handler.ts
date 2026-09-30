import type { IncomingMessage, ServerResponse } from 'node:http';
import { LetturaSchemaError } from '../../schemas/lettura.ts';
import { saveLettura } from './save.ts';

interface SavePayload {
  slug?: string;
  data?: unknown;
}

async function readJsonBody(req: IncomingMessage): Promise<SavePayload> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) chunks.push(chunk as Uint8Array);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? (JSON.parse(raw) as SavePayload) : {};
}

function respondJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
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
    try {
      const { slug, data } = await readJsonBody(req);
      const result = saveLettura({ contentDir, slug, input: data });
      await onSaved?.(result);
      respondJson(res, 200, { slug: result.slug });
    } catch (error) {
      if (error instanceof LetturaSchemaError) {
        respondJson(res, 400, { issues: error.issues });
        return;
      }
      respondJson(res, 500, { issues: [error instanceof Error ? error.message : String(error)] });
    }
  };
}
