import type { IncomingMessage, ServerResponse } from 'node:http';

/** Reads and JSON-parses a dev-middleware request body; an empty body parses to `{}`. */
export async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) chunks.push(chunk as Uint8Array);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? (JSON.parse(raw) as T) : ({} as T);
}

export function respondJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}
