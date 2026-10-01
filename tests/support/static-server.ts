import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
};

export interface StaticServer {
  url: string;
  close: () => Promise<void>;
}

/** Serves `root` over HTTP on an ephemeral port, Astro-style: a path ending in `/` maps to its `index.html`. */
export function serveStatic(root: string): Promise<StaticServer> {
  return new Promise((resolve, reject) => {
    const server: Server = createServer((req, res) => {
      void (async () => {
        try {
          const url = new URL(req.url ?? '/', 'http://localhost');
          let pathname = decodeURIComponent(url.pathname);
          if (pathname.endsWith('/')) pathname += 'index.html';
          const body = await readFile(join(root, pathname));
          res.writeHead(200, { 'content-type': MIME[extname(pathname)] ?? 'application/octet-stream' });
          res.end(body);
        } catch {
          res.writeHead(404);
          res.end('Not found');
        }
      })();
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (typeof address !== 'object' || address === null) {
        reject(new Error('static server has no address'));
        return;
      }
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        // `close()` alone waits for every connection to finish, including one a browser left with
        // half a request: the test calling it would sit there until its own timeout.
        close: () =>
          new Promise((res) => {
            server.close(() => res());
            server.closeAllConnections();
          }),
      });
    });
  });
}
