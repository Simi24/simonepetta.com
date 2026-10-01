import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import { APPUNTI_CONTENT_DIR } from '../../../../config/appunti-content-dir.ts';
import { isPublished } from '../../../../lib/corso-published.ts';

const figureDir = (slug: string): string => join(APPUNTI_CONTENT_DIR, slug, 'build', 'figure');

/** `/appunti/<slug>/figure/<name>.webp`: the images the pipeline re-encoded for a converted course (SPEC.md §7.4). */
export async function getStaticPaths() {
  const collection = await getCollection('appunti');
  return collection.filter(isPublished).flatMap((entry) => {
    const dir = figureDir(entry.id);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((file) => file.endsWith('.webp'))
      .map((file) => ({ params: { slug: entry.id, file } }));
  });
}

export const GET: APIRoute = ({ params }) => {
  const body = readFileSync(join(figureDir(params['slug']!), params['file']!));
  return new Response(body, { headers: { 'Content-Type': 'image/webp' } });
};
