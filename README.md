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
npm run check          # astro check
npm run build
```

## Setup

- Cloudflare API tokens: `scripts/setup-cloudflare.sh`, a guided wizard (tokens never pass through an agent).
- Visual contracts: `docs/prototype/visual.html` (site) and `docs/prototype/scrivania.html` (writing desk).
