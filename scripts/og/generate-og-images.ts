import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Generates the site's Open Graph images (SPEC.md §8, §12.3): one static, typographic
 * PNG per section, screenshotted from an HTML template and committed. Run once by hand
 * (`npm run og:generate`) whenever a section's image needs to change; nothing here runs
 * at build time.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const FONT_PATH = join(ROOT, 'public/fonts/host-grotesk-latin.woff2');
const OUT_DIR = join(ROOT, 'public/og');

const WIDTH = 1200;
const HEIGHT = 630;

interface OgImage {
  file: string;
  title: string;
  domain: string;
}

/**
 * One image per site section (SPEC.md §12.3: "no per-post generation"). Readings shares this
 * one section image across `/letture/` and every post page, same as the about pages share
 * `about.png` across `/` and `/en/`.
 */
const IMAGES: readonly OgImage[] = [
  { file: 'about.png', title: 'Simone Petta', domain: 'simonepetta.com' },
  { file: 'letture.png', title: 'Letture', domain: 'simonepetta.com' },
];

function template(image: OgImage, fontDataUri: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @font-face {
        font-family: "Host Grotesk";
        font-weight: 300 800;
        src: url(${fontDataUri}) format("woff2");
      }
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      html,
      body {
        width: ${WIDTH}px;
        height: ${HEIGHT}px;
      }
      body {
        background: #ededeb;
        color: #161616;
        font-family: "Host Grotesk", sans-serif;
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 90px;
      }
      h1 {
        font-size: 108px;
        font-weight: 700;
        letter-spacing: -0.04em;
        line-height: 0.94;
        margin: 0 0 28px;
      }
      .rule {
        width: 90px;
        height: 4px;
        background: #161616;
        margin-bottom: 28px;
      }
      p {
        font-size: 32px;
        font-weight: 500;
        letter-spacing: -0.01em;
        margin: 0;
      }
    </style>
  </head>
  <body>
    <h1>${image.title}</h1>
    <div class="rule"></div>
    <p>${image.domain}</p>
  </body>
</html>`;
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  const fontDataUri = `data:font/woff2;base64,${readFileSync(FONT_PATH).toString('base64')}`;

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
    for (const image of IMAGES) {
      await page.setContent(template(image, fontDataUri), { waitUntil: 'networkidle' });
      const path = join(OUT_DIR, image.file);
      await page.screenshot({ path });
      console.log(`wrote public/og/${image.file}`);
    }
  } finally {
    await browser.close();
  }
}

await main();
