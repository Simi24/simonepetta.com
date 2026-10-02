import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AstroConfig } from 'astro';
import type { ViteDevServer } from 'vite';
import { LetturaSchemaError, parseLettura } from '../../schemas/lettura.ts';
import { readJsonBody, respondJson } from './http.ts';
import type { PreviewPayload } from './payload.ts';

type MarkdownProcessor = AstroConfig['markdown']['processor'];
type MarkdownRenderer = Awaited<ReturnType<MarkdownProcessor['createRenderer']>>;
type SharedMarkdownOptions = Parameters<MarkdownProcessor['createRenderer']>[0];
type Container = Awaited<ReturnType<(typeof import('astro/container'))['experimental_AstroContainer']['create']>>;
type Post = Parameters<Container['renderToString']>[0];

export interface PreviewHandlerOptions {
  server: ViteDevServer;
  markdown: AstroConfig['markdown'];
  image: AstroConfig['image'];
  /** The real post component (SPEC.md §6.4: the preview reuses it, never a copy), as a Vite module id. */
  postEntrypoint: string;
}

/**
 * The dev-server preview handler (SPEC.md §6.4): renders the sheet's current draft — its body
 * turned to HTML by the site's own Markdown processor — through the real `Post` component via
 * Astro's container API, so the preview is never a hand-rolled copy of its markup.
 */
export function createPreviewHandler({ server, markdown, image, postEntrypoint }: PreviewHandlerOptions) {
  let rendererPromise: Promise<MarkdownRenderer> | undefined;
  let renderTargetPromise: Promise<{ container: Container; Post: Post }> | undefined;

  function getMarkdownRenderer(): Promise<MarkdownRenderer> {
    rendererPromise ??= markdown.processor.createRenderer({
      image,
      syntaxHighlight: markdown.syntaxHighlight,
      shikiConfig: markdown.shikiConfig,
      gfm: markdown.gfm,
      smartypants: markdown.smartypants,
    } as SharedMarkdownOptions);
    return rendererPromise;
  }

  function getRenderTarget(): Promise<{ container: Container; Post: Post }> {
    renderTargetPromise ??= (async () => {
      // Loaded on the first preview, so starting the dev server does not pay for it.
      const { experimental_AstroContainer: AstroContainer } = await import('astro/container');
      const container = await AstroContainer.create();
      // The `?container` query prepends the component's own scoped styles to the rendered
      // fragment (astro/container's own documented mechanism): without it, Post's grid and
      // typography would be missing from the preview pane entirely.
      const mod = (await server.ssrLoadModule(`${postEntrypoint}?container`)) as { default: Post };
      return { container, Post: mod.default };
    })();
    return renderTargetPromise;
  }

  return async function handlePreview(req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void): Promise<void> {
    if (req.method !== 'POST') {
      next();
      return;
    }
    try {
      const { data, testo } = await readJsonBody<Partial<PreviewPayload>>(req);
      const lettura = parseLettura(data);
      const renderer = await getMarkdownRenderer();
      const { code: testoHtml } = await renderer.render((testo ?? '').trim());
      const { container, Post } = await getRenderTarget();
      const html = await container.renderToString(Post, {
        props: { data: lettura },
        slots: { default: testoHtml },
      });
      respondJson(res, 200, { html });
    } catch (error) {
      if (error instanceof LetturaSchemaError) {
        respondJson(res, 400, { issues: error.issues });
        return;
      }
      respondJson(res, 500, { issues: [error instanceof Error ? error.message : String(error)] });
    }
  };
}
