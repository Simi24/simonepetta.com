# AGENTS.md: simonepetta.com

## What this repo is

The author's personal site: readings, university notes, and (v2) a per-course chat on the notes. **`SPEC.md` is the source of truth and is authoritative for implementation.** Read the sections an issue names before writing code; do not re-derive decisions the spec already made. Where an issue and `SPEC.md` disagree, stop and say so in the PR; do not pick one.

## Rules that are easy to break

- **The author writes, never an LLM** (`SPEC.md` §1.2 point 3). Agents write functional interface copy (labels, captions, empty states, errors). Anything in the author's voice or in first person (section ledes, bio, about texts, reading reactions) is a visible placeholder styled with `.placeholder` until the author writes it.
- **Site and private wiki are independent.** Never read, import or sync anything from `Simi24/llm-wiki`.
- **No chat model from Anthropic** in v2: the models are decided in `SPEC.md` §9.3.
- **Static by default.** No Astro route is dynamic; the only dynamic endpoint is the separate chat Worker on `/api/*` (v2). One dev-only exception: the writing desk's `/scrivi` route is `prerender: false` and exists only under `astro dev` (`SPEC.md` §6.4); `build` and `preview` never register it, and a test fails if any trace reaches `dist`.
- **Dependencies**: only those listed in `SPEC.md` §4.1. Any other one must be justified in `SPEC.md` first, in the same PR.
- **Nav links appear only when their page exists.** A section is added to `src/config/nav.ts` in the same change that adds its page; the link test fails otherwise.
- **No accent color, no Tailwind, no MDX, no React.** Plain CSS with the tokens in `src/styles/tokens.css`; every color is a `light-dark()` token.
- Avoid in UI copy: em-dashes, uppercase eyebrow labels.

## Stack and conventions

- Astro 7, `output: 'static'`, no adapter, `trailingSlash: 'always'`.
- **Node 24 LTS** (`.nvmrc`, the single place the version lives). TypeScript strictest; named exports (Astro and tool configs keep their required default export). Exception: `src/scripts/theme.js` is plain JS because it is inlined verbatim into every page. Exception: `public/scripts/cerca.js` is plain JS because it is served as-is from `public/` (never bundled or compiled) as a linked file, so the byte budget measures it and the one-inline-script rule holds.
- Micro-files: many small, focused components and modules.
- Italian for readings, notes and their UI; English for code, comments, commits, docs and PRs.
- `SITE_INDEXABLE` (build-time env, default `false`) drops `noindex`. It stays off until the v0 launch and is never set on previews.

## Testing

- **TDD**: red, then green, one behavior at a time, at the seams below. No test against internals.
- **`npm test`**: `node:test` files in `tests/`, run serially (parallel Astro builds race on the shared cache). Build-based tests build the site into a temporary directory through `tests/support/built-site.ts` and assert on the output.
- **`npm run test:browser`**: Playwright against a fresh build served by `astro preview` (never a reused server).
- **`npm run test:browser-dev`**: the one exception to the line above, for the writing desk, which exists only under `astro dev`: `playwright.scrivania.config.ts` starts its own foreground `astro dev` on a fixed port with `LETTURE_CONTENT_DIR` pointing at a temporary directory (never `src/content/letture/`), one worker.
- Seams in use: the built output (`dist`), behavior in a real browser, the token contract file, schema modules shared with the writing desk (tested as units, e.g. `src/schemas/lettura.ts`).
- No network and no credentials in tests.

## Git conventions (enforced by hooks)

- Branch: `<type>/<short-description>`; ralph-gh uses `ralph/issue-<N>-<slug>`, ASCII only.
- Commit message: `<type>: <gitmoji> <description>`, e.g. `feat: ✨ add the reading shelf`.
- **Never add a `Co-Authored-By` trailer**: the hook refuses it.
- Agents never push to `main`: open a PR.

## Critical paths (force the gate's deepest review tier)

| Path | Why |
|---|---|
| `infra/` | the author's personal AWS account and the live Cloudflare zone; Terraform is `fmt`/`validate` only, `apply` is a human act (`SPEC.md` §10.3) |
| `.github/workflows/` | deploys to production and holds the Cloudflare token |
| `wrangler.jsonc`, `workers/` | production routing, secrets, rate limits |
| `agent/` | spends real money per request; spend counter and quotas (`SPEC.md` §9.4) |
| `pipeline/` leak detector | the only guard against silently wrong math in published notes (`SPEC.md` §7.5) |
| `src/scripts/theme.js` | runs before paint on every page, inside a 1 KB budget |
