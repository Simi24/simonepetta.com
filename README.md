# simonepetta.com

Personal site: readings, university notes and, later, a chat on the notes. The design is in [`SPEC.md`](SPEC.md); conventions for contributors and agents are in [`AGENTS.md`](AGENTS.md).

## Develop

Requires Node 24 (`nvm use`).

```sh
npm ci
npm run dev            # http://localhost:4321
npm test               # build-based and unit tests (node:test)
npm run test:browser   # Playwright, first run: npx playwright install chromium
npm run test:quality   # axe (WCAG 2.2 AA) + the byte budget on `dist` (SPEC.md §12)
                        # standalone, this always rebuilds `dist` first, so it never
                        # checks stale output; set QUALITY_GATE_REUSE_DIST=1 to check
                        # an already-fresh `dist` (used in CI and in the verify commands,
                        # right after their own `npm run build`)
npm run check          # astro check
npm run build
```

## Convert a course to HTML

Outside the site build, with Docker running (the image is built on first use, a few minutes):

```sh
npm run appunti:convert -- <slug>   # reads appunti/<slug>/src/main.tex, writes build/, <slug>.pdf and meta.json
```

Needs `pdfinfo` (poppler) on `PATH` for the page count. Details and limits: `SPEC.md` §7.4.

## Setup

- Cloudflare API tokens: `scripts/setup-cloudflare.sh`, a guided wizard (tokens never pass through an agent).
- Visual contracts: `docs/prototype/visual.html` (site) and `docs/prototype/scrivania.html` (writing desk).
