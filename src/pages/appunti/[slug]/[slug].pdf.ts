import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import { APPUNTI_CONTENT_DIR } from '../../../config/appunti-content-dir.ts';
import { assertPdfSize } from '../../../lib/corso-pdf.ts';
import { isPublished } from '../../../lib/corso-published.ts';

/** `/appunti/<slug>/<slug>.pdf`: the PDF stays downloadable in every state (SPEC.md §7.1, §7.3). */
export async function getStaticPaths() {
  const collection = await getCollection('appunti');
  return collection.filter(isPublished).map((entry) => ({ params: { slug: entry.id } }));
}

export const GET: APIRoute = ({ params }) => {
  const slug = params['slug']!;
  const pdfPath = join(APPUNTI_CONTENT_DIR, slug, `${slug}.pdf`);
  const body = readFileSync(pdfPath);
  assertPdfSize(body.byteLength, slug);
  return new Response(body, { headers: { 'Content-Type': 'application/pdf' } });
};
