# simonepetta.com: Specification

This document describes, end to end, how simonepetta.com is built: principles, releases, stack, content models, pipelines, hosting, quality gates and the build plan for all three releases.

**No decision in this document is new.** Every section summarizes and links the ticket that made the decision. Tickets are GitHub issues in this repository, written in Italian; the wayfinding map that indexes them is [issue #1](https://github.com/Simi24/simonepetta.com/issues/1). **For implementation, this document is authoritative**: an implementer never needs to open a ticket. If a conflict with a ticket is found, open an issue and fix this document; do not guess. Conflicts found while writing it, and the defaults that close gaps found by the cold read, are listed in [§15.2 Reconciliations](#152-reconciliations).

Visual contracts are clickable prototypes, not prose. They live in [`docs/prototype/`](https://github.com/Simi24/simonepetta.com/tree/docs/prototype-visual/docs/prototype) (branch `docs/prototype-visual`, copied to `main` in slice S0).

---

## 1. Purpose and principles

### 1.1 Why the site exists
The root answer, from the grilling of 2026-09-23 ([map notes](https://github.com/Simi24/simonepetta.com/issues/1)): **"there is a place that is mine"**, not on LinkedIn, not inside someone else's platform. Four consequences constrain every decision downstream:

1. **Durability beats discoverability.** The site must still be there in five years without a rewrite. Content lives in plain files that survive the framework: if Astro dies, the posts stay readable. No lock-in.
2. **SEO, analytics and recruiter optimization are welcome, not the metric.** Exception: findability matters for the notes section and the about page, not for readings ([#18](https://github.com/Simi24/simonepetta.com/issues/18)).
3. **The chat is not needed by the site.** The site is "mine" without it. v2 is built because the author wants to build it.
4. **Tinkering is part of the pleasure.** The site is a workshop, not a product to ship. A more interesting stack is legitimately preferable to a boring one.

**Editorial thread**: the public record of what the author reads, what he studied and what he builds. Not a portfolio, not a blog: the trace of someone learning in public. **No deadline**: the order is set by pleasure, not by a date.

### 1.2 Standing constraints
1. **Static by default, a single dynamic endpoint** in the whole site (`POST /api/chat`, v2). Sections do not share their fate: if the chat exhausts its budget, readings and notes stay up.
2. **Heavy ingestion stays out of the build.** Conversion artifacts are produced separately and committed; a change to readings never depends on a broken `\input` in a 2022 course.
3. **The author writes, never an LLM.** Reading reactions and personal texts are written by the author. Agents build scaffolding, never content, and quote the author's words verbatim. **Interface copy rule**: functional copy that explains the interface (labels, captions, empty states, error messages, e.g. "Spine height follows page count") may be written by agents; anything in the author's voice or in first person (section ledes, bio, "about" texts) is a visible placeholder until the author writes it. The ledes in the prototypes are placeholders, not approved copy.
4. **Site and private wiki are independent systems** ([#8](https://github.com/Simi24/simonepetta.com/issues/8)). No export, no sync, no wiki content on the site. The build never reads the private repo `Simi24/llm-wiki`.
5. **Language follows each section's audience**: readings and notes in Italian; projects/OSS in English; the about page exists in both languages as two separate pages (`/` and `/en/`), never mixed.
6. **"Done well" means both qualities**: the visible result (typography, performance, accessibility, care) and the project underneath (structure, maintainability, no shortcuts).
7. **React is avoided, not forbidden.** The chat island uses Preact ([#2](https://github.com/Simi24/simonepetta.com/issues/2)).
8. **Minimal** means light for the visitor and clean to maintain, built with real tools. It does not mean "no toolchain".

### 1.3 Who does what
The implementation and the conversion of notes are done by agents. Non-delegable, always the author's: **the texts he writes**, the **review of converted math** (a silent error in his notes can only be recognized by whoever wrote them), and the **review of the chat golden set** ([#11](https://github.com/Simi24/simonepetta.com/issues/11)).

---

## 2. Releases

Three sequential releases of **the same site**: same repository, same origin, same shell. Each is useful on its own ([map](https://github.com/Simi24/simonepetta.com/issues/1)).

| Release | Contents | Size |
|---|---|---|
| **v0** | Shell, readings, about (IT + EN) with colophon, the local writing desk, RSS, analytics, quality gates. Replaces `minimal-portfolio`. | days |
| **v1** | Notes: all 30+ courses + 2 theses published as PDF, notes index, course pages, Pagefind search, conversion pipeline, first HTML conversions (incremental afterwards). | weeks, mostly ingestion |
| **v2** | Per-course chat agent on converted courses, with spend caps, eval and in-page trace. | weeks |

**Non-goals**: writing the content (author); restructuring the private wiki; comments, newsletter, accounts; an online CMS (writing happens locally, [#16](https://github.com/Simi24/simonepetta.com/issues/16)); a cross-course chat ([#11](https://github.com/Simi24/simonepetta.com/issues/11)); a separate theses section ([#9](https://github.com/Simi24/simonepetta.com/issues/9)).

---

## 3. Information architecture and URLs

One origin, no subdomains ([#7](https://github.com/Simi24/simonepetta.com/issues/7)). Flat paths, no dates in URLs, Italian slugs.

```
/                                  home + about (IT), colophon at the bottom
/en/                               about (EN)
/letture/                          readings index: shelf + grouped list
/letture/<slug>/                   one book's post page, generated only for books with a text
/letture/rss.xml                   feed of readings with a text
/appunti/                          notes index: bound theses + notebook piles + full list
/appunti/<slug>/                   course (or thesis) page, in every state
/appunti/<slug>/<chapter>/         one chapter (converted courses only)
/appunti/<slug>/<slug>.pdf         the PDF
/appunti/<slug>/chat/              chat page (v2, static page with a Preact island)
/appunti/valutazione/              chat eval report (v2, static)
/cerca/                            search page (v1, Pagefind UI loads only here)
/api/chat                          the only dynamic endpoint (v2, separate Worker)
/404.html, /robots.txt, /sitemap.xml
/scrivi                            writing desk, exists only under `npm run dev`
```

- **Trailing slashes** on all page URLs (`trailingSlash: 'always'`).
- **`/api/chat` is the single dynamic endpoint** and also bootstraps the session: a first request carrying a Turnstile token returns a signed session token; later requests carry that token. There is no separate session endpoint.

- **No Astro route is dynamic.** The chat page is static; the dynamic part is `/api/*` on a separate Worker ([#6](https://github.com/Simi24/simonepetta.com/issues/6), superseding the `prerender = false` note in [#7](https://github.com/Simi24/simonepetta.com/issues/7)).
- **Slugs are fixed at creation**: editing a title later changes neither the file name nor the URL ([#16](https://github.com/Simi24/simonepetta.com/issues/16)).
- `simonepetta.com` **replaces** the old `minimal-portfolio` on Vercel: redirect, then shut it down ([map notes](https://github.com/Simi24/simonepetta.com/issues/1)).

---

## 4. Stack and repository layout

### 4.1 Stack ([#6](https://github.com/Simi24/simonepetta.com/issues/6))
- **Astro 7**, `output: 'static'`, **no adapter**. Without islands Astro is a static site generator; islands arrive only with the v2 chat ([#2](https://github.com/Simi24/simonepetta.com/issues/2)).
- **Plain Markdown (`.md`)** for hand-written content. **No MDX**: components live in layouts, never in content.
- **Plain CSS + Astro scoped `<style>`**, design tokens as custom properties. **No Tailwind** (deliberate deviation from the author's global default).
- **TypeScript strict** for config, components and Workers. **Python 3.12+** for the v2 Lambda.
- **npm + Node LTS**, lockfile committed.
- **Allowed dependencies**: `astro`; `pagefind` (v1, [#10](https://github.com/Simi24/simonepetta.com/issues/10)); `@astrojs/preact` + `preact` (v2). Dev-only: `wrangler`; `@astrojs/check` + `typescript` (for `astro check`), `@types/node` (so tests and tool configs are type-checked too); `@playwright/test` + `@axe-core/playwright` (accessibility gate in both color schemes, [#18](https://github.com/Simi24/simonepetta.com/issues/18)). **Tests** use Node's built-in `node:test` (no dependency) plus build-based fixture tests. Python (v2): `boto3`, and the test runner `pytest`. **Any other dependency must be justified in this document first.**

### 4.2 Repository layout
```
SPEC.md, README.md, AGENTS.md, .ralph-gh.config, .nvmrc
astro.config.mjs, tsconfig.json, package.json, playwright.config.ts, wrangler.jsonc (site Worker)
src/
  config/                   site-wide settings, nav sections
  scripts/theme.js          the inline theme script (plain JS, inlined in <head>)
  content.config.ts         content collections: letture, appunti (manifests)
  content/letture/<slug>.md one file per book
  pages/ layouts/ components/
  styles/tokens.css         the visual contract as custom properties (light-dark() pairs)
  integrations/scrivania/   dev-only writing desk (see §6.4)
public/fonts/               Host Grotesk + Fira Math, woff2, self-hosted
appunti/<slug>/
  corso.yaml                manifest, hand-written
  <slug>.pdf                the PDF
  meta.json                 produced by the pipeline (page count, …), see §15.2
  src/                      only if converted: the canonical .tex
  build/                    only if converted: pipeline output, committed
pipeline/                   Dockerfile (LaTeXML via BookML) + conversion and check scripts
workers/api/                v2: the chat Worker
agent/                      v2: the Python Lambda
infra/                      Terraform (Cloudflare + AWS providers)
.github/workflows/          site, appunti, api (v2), agent (v2), eval (v2)
tests/                      node:test files (build-based and unit), tests/browser/ for Playwright
docs/research/, docs/prototype/
```

---

## 5. Visual contract

Direction **"Tipografico"** ([#9](https://github.com/Simi24/simonepetta.com/issues/9)). The contract is the prototype: [`docs/prototype/visual.html`](https://github.com/Simi24/simonepetta.com/blob/docs/prototype-visual/docs/prototype/visual.html) (v5). Build from it, not from this summary; where §5.1 explicitly changes the prototype (contrast fix, tint hash, links), §5.1 wins.

### 5.1 Tokens
| Token | Light | Dark |
|---|---|---|
| background | `#ededeb` | `#151515` |
| ink | `#161616` | `#ebebe8` |
| secondary text | `#646462` | `#9a9a97` |
| rules | `#cfcfcc` | `#2e2e2d` |
| surface | `#e2e2df` | `#1f1f1e` |
| spine / notebook tints (background → text) | `#161616→#ededeb` `#4a4a48→#ededeb` `#2c2c2b→#ededeb` `#9a9a97→#161616` `#d2d2cf→#161616` | `#ebebe8→#151515` `#b5b5b2→#151515` `#d0d0cd→#151515` `#626260→#ebebe8` `#3a3a39→#ebebe8` |

- Contrast fix after the cold read: the dark mid-grey tint is `#626260` (the prototype had `#6e6e6c`, 4.28:1), and spine/notebook text has **no opacity** (the prototype dimmed the author's surname to 75%, down to 3.17:1). Every tint pair must pass WCAG AA for its text size; the axe gate checks it.
- **No accent color.** Links in running text are always underlined. Navigational objects (nav items, brand, spines, notebooks, thesis cards) are recognizable as links by form and have no underline; they get a visible focus style.
- **Theme** follows the system, both themes are designed, plus a three-state manual toggle (system / light / dark) remembered in `localStorage` ([#9](https://github.com/Simi24/simonepetta.com/issues/9)). It needs one inline script of at most 1 KB that sets `data-theme` before paint (budget exception, [§12.2](#122-performance-budget-blocking-checked-on-dist)).
- **Theme toggle placement**: a text button in the nav (as in the desk prototype, "Tema: sistema"), handled by the same inline script.
- **Nav links** appear only when their target exists ("Appunti" from S6, "EN" from S3), so the shell never links to a 404.
- **Tint assignment** is stable: derived from a hash of the slug, not from list position, so colors do not reshuffle when a book is added.

### 5.2 Typography and layout
- **Host Grotesk** for everything, self-hosted woff2 with a Latin subset (OFL).
- **Fira Math** for MathML, self-hosted woff2, loaded **only on pages with math** ([#10](https://github.com/Simi24/simonepetta.com/issues/10)). Accepted cost: HTML math does not match the PDFs' Computer Modern.
- **12-column grid**; sections have a 2px top rule, label on the left, content from column 5. Single column under 860px.
- **Scale**: very large h1 (up to ~7.4rem, line-height 0.94, tracking −0.04em); grades as large numerals, weight 300.
- Avoided on purpose: em-dashes in UI copy, uppercase eyebrow labels, cream + terracotta palettes, Inter, Fraunces.

### 5.3 Signature objects (each encodes real data)
- **Shelf** (`/letture/`, and the desk's menu): one spine per book. **Height = pages**; **bookmark = reading now**; **leaning = abandoned**; spine text reads bottom to top, as on Italian books. The full list sits below.
- **Notebook piles** (`/appunti/`): one pile per year of study, **thickness = pages of notes**; **tab = readable as HTML**; **dashed outline = scanned**.
- **Bound theses**: two solid volumes at the top of `/appunti/`.
- **Colophon**: last section of the about page.
- Rejected: a per-course "barcode" of chapters (needed explaining, so it was decoration).

### 5.4 Notes pages
LaTeX conventions: **Theorem n.m** in bold with the name in parentheses, **Proof.** in italics ending with ∎, notes as indented blocks with a rule, chapter table of contents sticky on the left. A notice at the top: student notes, may contain errors, not official course material.

---

## 6. Readings

### 6.1 Content model ([#8](https://github.com/Simi24/simonepetta.com/issues/8))
One file per book, `src/content/letture/<slug>.md`, frontmatter validated by the content collection schema (a wrong field fails the build).

| Field | Rule |
|---|---|
| `titolo`, `autore` | required |
| `anno_opera` | optional integer |
| `stato` | `in-corso` \| `letto` \| `abbandonato` |
| `iniziato` | optional date |
| `finito` | date; **required** for `letto`, optional for `abbandonato` (the day it was dropped), **forbidden** for `in-corso` |
| `voto` | optional, 1 to 5 in steps of 0.5, **forbidden** for `in-corso`; no modifiers like "3,5+" |
| `pagine` | optional integer, drives spine height; default 250, clamped to 80..1000 for display |
| `nota` | optional one-liner, used for abandoned books |

The schema is **strict** (unknown keys fail) and lives in its own module, so the writing desk validates with the same code. The body is the author's text and is **optional**. Italian.

- **Slugs**: kebab-case of the title, fixed at creation. On a collision, append the author's surname.
- **Re-reads** are out of scope: one file per book; a re-read updates the dates.
- **Ordering**: shelf and index show *in corso* (by `iniziato` descending), then *letti* (by `finito` descending), then *abbandonati* (by `finito` descending). The home shows the three most recently finished books.
- **Empty state**: with no books the shelf shows an empty plank and a one-line functional caption. Test fixtures never enter the production collection.
- **Known limitation**: YAML rolls an impossible *unquoted* date forward (`2026-02-30` becomes `2026-03-02`) before the schema ever sees it, so only a quoted date is validated strictly; the writing desk always writes quoted ISO dates.

### 6.2 What appears
**All books**, including the one being read and abandoned ones. The index is the shelf plus a list grouped as *Sto leggendo / Letti / Abbandonati*, grades as large numerals. A book with a text links to its post; a book without a text still appears with grade and dates.

### 6.3 Independence from the wiki
The private wiki keeps its own `letti.csv`. Nothing flows between the two repositories; duplicating 4 or 5 fields per book is accepted ([#8](https://github.com/Simi24/simonepetta.com/issues/8)). The wiki's `libri` skill still describes the old export and must be updated in a wiki session (out of scope here).

### 6.4 The writing desk ([#16](https://github.com/Simi24/simonepetta.com/issues/16))
Contract: [`docs/prototype/scrivania.html`](https://github.com/Simi24/simonepetta.com/blob/docs/prototype-visual/docs/prototype/scrivania.html) (v2).
- **Dev-only**: a local Astro integration calls `injectRoute({ pattern: '/scrivi', … })` only when `command === 'dev'`; in `astro:server:setup` it adds a `server.middlewares` handler (e.g. `POST /__scrivania/save`) that validates the payload with the same schema as the content collection, writes the file, then calls `refreshContent()`. No production endpoint, no auth.
- **The shelf is the menu.** Reading now: *finished, write* / *finished, no text* / *left halfway* (one line why) / *edit*. Read: *edit* or *write the text*. Abandoned: *edit* / *start again*. A dashed spine adds a book.
- **Writing**: a large sheet, a **20-minute timer that starts at the first keystroke** and only suggests saving when it ends (it never locks), a word counter toward ~250, the four format questions as an **optional** outline (click turns one into a `##` heading), clickable half-point grades, prefilled dates.
- **Editing** any existing entry: text, grade, dates, title, author, year, abandonment note. **The timer does not run while editing.**
- **Preview** uses the same component as the real post page, not a copy.
- **Publishing** stays a human gesture: commit and push; deploy is automatic ([§11](#11-build-and-deploy)). From a phone, the fallback is GitHub's web editor.

### 6.5 Feed and SEO
`/letture/rss.xml` with the posts that have a text, from a static endpoint with no dependency ([#18](https://github.com/Simi24/simonepetta.com/issues/18)). SEO for readings is minimal: title, description, canonical, sitemap. No `Book` structured data.

---

## 7. Notes

### 7.1 Corpus and publication policy ([#5](https://github.com/Simi24/simonepetta.com/issues/5), [#14](https://github.com/Simi24/simonepetta.com/issues/14))
**All sources are already off Overleaf** (export of 2026-09-29) in the private archive repo [`Simi24/appunti-sorgenti`](https://github.com/Simi24/appunti-sorgenti): **30 course projects (13 magistrale, 17 triennale) + 2 theses** (`tesi-magistrale`, `tesi` for the triennale), with Overleaf-compiled PDFs for 29 of them. Also: `GPUcomputing` and `Social_Mining` on GitHub (built PDFs); `LinguaggiTraduttori` on GitHub is the complete version of an Overleaf stub; `Elaborazione Segnali` exists both on Overleaf and as a scan. Six Overleaf projects are barely started (3 to 5 pages); publishing them is the author's call per course in S6.
- **All published as PDF at launch; HTML is converted one course at a time afterwards, starting with the courses the author wants to chat with.** No curation by quality: elementary is not wrong, and the year label gives context. The **only allowed exclusion is rights** (notes that copy lecturer slides or reproduce textbook figures), checked course by course before publishing.
- **PDFs are built locally** with TeX Live in Docker, the same toolchain as the pipeline: Overleaf's free plan times out on the large projects. Overleaf is not used anymore.
- The archive repo stays the complete copy; a course's `.tex` enters this repo (`appunti/<slug>/src/`) only when it is converted.

### 7.2 Manifest ([#10](https://github.com/Simi24/simonepetta.com/issues/10))
`appunti/<slug>/corso.yaml`, validated by an Astro schema:

| Field | Rule |
|---|---|
| `titolo` | required |
| `tipo` | `corso` \| `tesi` |
| `livello` | `triennale` \| `magistrale` |
| `anno` | 1 to 3 (triennale), 1 to 2 (magistrale); optional for `tesi` |
| `aa` | academic year, e.g. `"2019/20"` (for a thesis: the year of the defense) |
| `fonte` | `overleaf` \| `github` \| `locale` \| `scansione` (where the source came from) |
| `pubblicato` | boolean |
| `motivo` | required when `pubblicato: false` |

**State is derived, never declared**: `scansione` if `fonte: scansione`; `html` if a valid `build/` exists; otherwise `pdf`. **Page counts** live in `appunti/<slug>/meta.json` at the course root, produced by a lightweight pipeline step for every course (page count from the PDF), never typed by hand; `build/` stays conversion-only. Theses are not in the piles, only on top. Site-wide config holds the **university and degree programme names per level** (`triennale`, `magistrale`, which may differ), used in titles for SEO ([#18](https://github.com/Simi24/simonepetta.com/issues/18)). PDFs must stay under Cloudflare's 25 MiB per file (the largest today is ~13 MB).

### 7.3 Pages
- **Index** `/appunti/`: bound theses on top, notebook piles by year, a full list below, the student-notes notice.
- **Course page** `/appunti/<slug>/` exists in **every** state, so neither state looks like a leftover: metadata, the PDF, and for converted courses the chapter list (and in v2 the chat link).
- **Chapters** `/appunti/<slug>/<chapter>/`: one page per chapter, sticky TOC, LaTeX conventions (§5.4). **Chapter slugs** are `<number>-<kebab-title>` (e.g. `3-variabili-aleatorie-continue`), computed at the first conversion and recorded in `build/meta.json`; later conversions reuse them, so URLs never change. LaTeXML output is post-processed by the pipeline into HTML fragments (body only), which Astro wraps in the site layout.
- **Excluded** courses (`pubblicato: false`) are skipped entirely: no page, no PDF in the assets.
- **Scanned** courses stay PDF forever.
- **Search**: Pagefind, run after `astro build`, indexing readings and notes pages (not PDF contents). The UI lives on its own page, `/cerca/`, linked from the nav from v1; no search JS loads on any other page.

### 7.4 Conversion pipeline ([#4](https://github.com/Simi24/simonepetta.com/issues/4), [#10](https://github.com/Simi24/simonepetta.com/issues/10))
- **LaTeXML via BookML**, in Docker, **outside the site build**: `make appunti CORSO=<slug>` (or equivalent). Output is committed into `build/`. The site build has no LaTeX and no Docker.
- **HTML directly, no intermediate Markdown**: Markdown has no numbered theorems and every extra stage is a loss point. Fixes go into the `.tex`.
- **MathML native**, zero JS. Caveat: MathML Core does not cover numbered equations; LaTeXML's output handles numbering.
- **TikZ** via `standalone[dvisvgm]` → DVI → dvisvgm. The pipeline rewrites black in SVGs to `currentColor`, so figures follow both themes. **Alt text stays manual**, written at conversion time; a figure without a description **fails** the detector.
- **pandoc is rejected**: it loses silently (drops TikZ, ignores `\NewDocumentCommand`, overrides custom macros with builtins).
- **Canonical source**: when a course is converted, its sources are copied from `Simi24/appunti-sorgenti` into `src/`; from then on the `.tex` in `src/` is canonical.
- **Expected cost**: weeks; roughly 1 course in 4 needs real manual intervention. The cost scales with courses, not with the pipeline.

### 7.5 Leak detector
Conversion fails silently, so verification cannot be the human eye. The detector compares source and output on `tikzpicture` vs produced SVGs, theorem environments, equations, and LaTeXML error counts. **Any mismatch fails the conversion and `build/` is not updated.** It runs locally and in CI ([§11](#11-build-and-deploy)). **A course that stops compiling keeps its last good `build/`**; the red stays in the pipeline workflow and never reaches the deploy.

---

## 8. About and colophon

Structure prototyped in [#9](https://github.com/Simi24/simonepetta.com/issues/9); **texts are written by the author** (out of scope for agents).
- `/`: name, one-line lede, bio paragraphs, **Percorso** (timeline), **Open source** (e.g. `dynantic`), latest readings, **Colophon**.
- `/en/`: the English about page, with English navigation and labels and no Italian content blocks (no latest readings). `hreflang` links the two.
- Open Graph images are designed by an agent from the visual contract (typographic, no photos). `sameAs`: GitHub `https://github.com/Simi24`, LinkedIn `https://www.linkedin.com/in/simone-paolo-petta/`.
- **Colophon**, six lines: typeface (Host Grotesk), math (MathML drawn by the browser without JavaScript), notes (LaTeX converted with LaTeXML outside the build), build (Astro, static pages), hosting (Cloudflare Workers), writing (Markdown from a local desk, texts written by hand without language models).
- **SEO priority high** ([#18](https://github.com/Simi24/simonepetta.com/issues/18)): JSON-LD `Person` with `sameAs` (GitHub, LinkedIn), curated Open Graph image.

---

## 9. Chat (v2)

### 9.1 Shape ([#11](https://github.com/Simi24/simonepetta.com/issues/11), [#15](https://github.com/Simi24/simonepetta.com/issues/15))
**One agent per course**, available only on converted courses. It is an agent, not a fixed RAG pipeline: it decides what to search, what to open and when to stop.

```
Preact island (static page /appunti/<slug>/chat/)
  → POST /api/chat   Cloudflare Worker: Turnstile, signed session, rate limit
    → AWS Lambda (Python, eu-south-1), hand-written tool-use loop
        → Cloudflare AI Gateway (spend limits) → model on Workers AI
        → S3 Vectors (search_course, filtered by course)
        → S3 section texts (read_section: whole sections, from LaTeXML output)
        → DynamoDB (session, monthly spend counter)
```

The Worker sits **in front of** the Lambda (same origin, no CORS).
- **No token streaming in v2.** Lambda response streaming is native only for Node.js and custom runtimes, not Python. The Worker returns the complete answer; the island shows progress states while waiting. Streaming via Lambda Web Adapter is a possible later improvement, not part of v2.
- **Worker → Lambda authentication**: Lambda Function URL with auth `NONE`, protected by an HMAC shared secret header that the Lambda verifies. The secret is generated by Terraform, stored in SSM Parameter Store for the Lambda, and set as a Worker secret by the `api` workflow. No long-lived AWS keys in the Worker.

### 9.2 Tools and answer rules
- `search_course(query)`: semantic search over the course's chunks, returns candidate sections with a snippet.
- `read_section(section_id)`: the **whole section, verbatim**. Vectors only locate; answers are built from whole sections, so math is never answered from fragments.
- `cite(section_id, anchor)`: records the source of a claim.
- **Loop with `max_steps`.** An answer without citations is rejected by the loop, which asks the model to cite or to say the information is not there. **"This is not in your notes" is a legitimate answer.** Questions about other courses get a pointer to the notes index and Pagefind, not an answer.
- The loop is **defensive**: validate tool arguments, retry malformed calls.
- **Trace**: collapsed under each answer ("how I got here": searches, sections opened, citations, tokens), visible only to the asker, no public trace pages.
- **Memory**: multi-turn within a session only, DynamoDB with a 24-hour TTL. No conversation history is kept.

### 9.3 Model and embeddings ([#17](https://github.com/Simi24/simonepetta.com/issues/17))
The author excluded Claude models for cost.

| Role | Choice | Path | $/month |
|---|---|---|---|
| Primary | DeepSeek V4 Flash `@cf/deepseek-ai/deepseek-v4-flash-0731`, non-thinking in the loop | Lambda → AI Gateway (OpenAI-compatible REST) → Workers AI, paid with **Unified Billing credits** (no Workers Paid needed) | ~1.8 with prefix caching, ~3.0 without |
| Fallback | GLM-4.7-Flash `@cf/zai-org/glm-4.7-flash` | Dynamic Route on the same gateway, triggered by the primary's spend limit | ~0.5 |
| Embeddings | Cohere Embed v4 `eu.cohere.embed-v4:0` | Bedrock, eu-south-1, outside the gateway | ~1.2 one-off |

Bedrock-hosted open models were not chosen because AI Gateway spend limits are not documented for them. The choice is **conditional on the golden set** run on both primary and fallback before launch; with a hand-written loop, swapping the model is configuration.

### 9.4 Spend and abuse protection
Budget: **5 EUR/month** ([#11](https://github.com/Simi24/simonepetta.com/issues/11)).
1. **AI Gateway spend limits** (hard `429`), production gateway: **$3.00/month** on the primary, then fallback; **$4.00/month** total. Eval gateway: **$0.50/month**. Total ceiling $4.50 + 5% credits fee ≈ $4.73, within 5 EUR ([#17](https://github.com/Simi24/simonepetta.com/issues/17) proposed $3.50/$4.50 for production alone; split here so evals fit the same budget).
2. **Monthly spend counter in DynamoDB**, atomic conditional update, `429` before calling the model.
3. **`max_steps`** per message.
4. **Rate limit by session, not by IP**: invisible **Turnstile** on the first `/api/chat` request, which returns a **signed session token**. Two layers: the Workers rate limiting binding keyed on the session (bursts: 3 requests per 10 seconds, the binding only supports 10 s or 60 s periods) and a per-session quota in DynamoDB (20 messages per day).
5. **Budget exhausted**: the chat shows "paused until the first of the month" and points to the course index and `/cerca/`, which are static and stay up.

### 9.5 Evaluation
Golden set of **~30 questions per course**, with expected sections and some "not in the notes" questions. **Drafted by an agent, reviewed by the author.** Metrics: recall of cited sections, citation correctness, correct refusals. Runs in CI with **a separate gateway and spend cap** so evals never consume production budget. The report is published as a static page. The first report on primary and fallback is the go/no-go input for the v2 launch, decided by the author.

---

## 10. Infrastructure

### 10.1 Cloudflare ([#3](https://github.com/Simi24/simonepetta.com/issues/3), [#6](https://github.com/Simi24/simonepetta.com/issues/6))
- **Workers Static Assets, not Pages** (Pages Functions lack the rate limiting binding). The site is a Worker with static assets only (no `main`, no `run_worker_first`) on the **Custom Domain** `simonepetta.com`, already in the account.
- The chat is a **second Worker on the route** `simonepetta.com/api/*`; routes run before the Custom Domain origin (verified in Cloudflare docs, *Custom Domains → Interaction with Routes*).
- Static asset requests are free and unlimited and do not consume quota: constraint 1 is guaranteed by the platform.
- Limits to watch: 20,000 files and 25 MiB per file on static assets; Workers free plan 100k requests/day (static assets excluded).
- AI Gateway (spend limits, Dynamic Route), Turnstile, **Web Analytics** site, `www` redirect, DNS TXT for Search Console.

### 10.2 AWS ([#15](https://github.com/Simi24/simonepetta.com/issues/15))
Region **eu-south-1** (Milan). Lambda (Python, hand-written loop, not AgentCore Runtime), DynamoDB, S3 Vectors, S3 for section texts, IAM, a GitHub **OIDC** role, the Terraform state bucket with locking. Bedrock Agents is closed to new customers and is not used.

### 10.3 Ownership ([#13](https://github.com/Simi24/simonepetta.com/issues/13))
| Resource | Owner |
|---|---|
| Site Worker code, its Custom Domain (which creates the apex DNS record itself) | `wrangler.jsonc` + `site` workflow |
| Chat Worker, route `/api/*`, rate limit binding, Worker secrets (Turnstile secret, session signing key, Lambda HMAC secret) | `workers/api/wrangler.jsonc` + `api` workflow (secrets come from GitHub secrets) |
| Lambda code | `agent` workflow; Terraform has `ignore_changes` on the code |
| AI Gateways (production and eval) + spend limits + Dynamic Route, Turnstile widget, `www` record + redirect rule, Search Console TXT | Terraform (Cloudflare provider); **never the apex record** |
| Lambda configuration, DynamoDB, S3 Vectors, S3 buckets, IAM, OIDC role, SSM parameters | Terraform (AWS provider) |
| Terraform state bucket (versioned, encrypted, S3 native lockfile) and an **AWS Budget** of $5/month with email alerts at 50%, 80% and 100% (actual) and 100% (forecast) | a separate `infra/bootstrap` config, applied once |

Terraform is applied **by hand from the author's Mac**, with remote state on S3 so it works from several machines. **AWS account: the author's personal one, CLI profile `personale`** (account `209556027092`). The AWS provider pins `profile = "personale"` and `allowed_account_ids = ["209556027092"]`: the machine's `default` profile is a different account and must never be touched. An AWS Budget only alerts, it never stops spending; the hard cap on model spend stays at the AI Gateway (§9.4). Terraform never owns code that changes often, or every deploy becomes drift.

**One-time manual steps** (the only configuration outside code): create the Web Analytics site in the dashboard (S4); create the scoped Cloudflare API tokens (script: `scripts/setup-cloudflare.sh`, a guided wizard) and store it with the account ID as GitHub secrets; start Search Console verification to get the TXT value; enable the opt-in region eu-south-1 and, for v2, Bedrock access to Cohere Embed v4; buy Workers AI Unified Billing credits (v2); confirm that the zone has no conflicting apex/`www` records. These are **S0/S10 prerequisites** the author provides.

### 10.4 Costs
v0 + v1: **$0 on Cloudflare** ([#3](https://github.com/Simi24/simonepetta.com/issues/3)); the only AWS resource before v2 is the Terraform state bucket (cents per month). v2: ~$0.5/month AWS infrastructure, ~$2 to 3/month model, hard cap $4.50 + fee; ~$1.2 one-off embeddings.

---

## 11. Build and deploy

([#13](https://github.com/Simi24/simonepetta.com/issues/13)) **GitHub Actions for everything**; no configuration lives in dashboards.

| Workflow | Trigger | Steps |
|---|---|---|
| `site` | push to `main`, PRs | checkout with full history (`fetch-depth: 0`, for sitemap `lastmod`) → `npm ci` → tests → `astro check` → `astro build` → `pagefind --site dist` (from S7) → quality gates (§12) → on `main`: `wrangler deploy`; on PRs: `wrangler versions upload` + comment with the preview URL |
| `appunti` | every PR and push; exits early when nothing under `appunti/**` or `pipeline/**` changed (so as a required check it never hangs) | checks that each course's `meta.json` matches its PDF; for converted courses runs the leak detector on the committed `build/`; a manual `workflow_dispatch` re-converts from `src/` in Docker and diffs against `build/`; **the deploy never depends on it** |
| `api` (v2) | changes to `workers/api/**` | tests → `wrangler deploy` of the chat Worker |
| `agent` (v2) | changes to `agent/**` | Python tests → on `main`: Lambda code deploy via OIDC (no long-lived AWS keys) |
| `eval` (v2) | PRs on `agent/**`, manual | golden set against the model with a separate gateway/cap → static report |

- **Posts**: the author commits and pushes to `main`; the deploy is automatic. If checks fail, the previous version stays online. `main` has no branch protection that would block the author's direct pushes; the checks inside the `site` workflow are the gate.
- **Previews and pre-launch**: preview versions and the site before the v0 launch (S5) send `noindex` (a meta tag driven by a build flag) and do not load the analytics beacon. Preview URLs are enabled in `wrangler.jsonc`; the production `workers.dev` hostname stays disabled so the site is never indexed twice. `www` is a proxied `AAAA 100::` record with a path-preserving redirect rule to the apex.
- **Code**: agents open PRs (the author's global hooks block agents from pushing to `main`); each PR gets a preview URL.
- **Other machines**: the repo is the only source; pull, write, push. From a phone, GitHub's web editor.
- **Rollback**: `wrangler rollback` to the previous version, no rebuild.
- **Secrets**: a minimally scoped Cloudflare API token and the OIDC role ARN.

---

## 12. Quality

([#18](https://github.com/Simi24/simonepetta.com/issues/18))

### 12.1 Accessibility
**WCAG 2.2 AA**, checked by **axe on every built page** in the `site` workflow; a violation **blocks the deploy**. Manual checklist for new page types: keyboard, visible focus, screen reader on a notes page with MathML.

### 12.2 Performance budget (blocking, checked on `dist`)
| Resource | Cap (gzip) |
|---|---|
| JS on normal pages | the Web Analytics beacon + one inline theme script ≤ 1 KB |
| Declared JS exceptions | Pagefind on `/cerca/` only, Preact island on chat pages only |
| HTML per page | 50 KB; 150 KB for notes chapters |
| CSS per page | 20 KB |
| Fonts | Host Grotesk Latin subset (roman + italic); Fira Math only on math pages |

Raising a cap requires an explicit commit to the budget config.

### 12.3 SEO
- **Notes (high)**: titles and descriptions with course, level and university; JSON-LD `LearningResource` (`inLanguage: it`, `educationalLevel`, `about`); PDFs at stable URLs with descriptive link text and `rel="alternate" type="application/pdf"` from the course page; HTML chapters are indexable text and MathML.
- **About (high)**: see §8.
- **Readings (low)**: title, description, canonical, sitemap only.
- **Everywhere**: sitemap with `lastmod` from git, canonical URLs, one static Open Graph image per section (no per-post generation). Search Console verified via DNS TXT in Terraform; Bing Webmaster Tools is already verified.

### 12.4 Analytics
**Cloudflare Web Analytics**: cookieless (no banner), free. Accepted cost: one beacon script on every page. The site is created once by hand in the dashboard (the Web Analytics API rejected the Terraform token in setup, not worth the permissions); its public site token is committed to the site config; the snippet lives in the layout (no dashboard auto-injection).

---

## 13. Declared risks

| Risk | Mitigation | Source |
|---|---|---|
| No account-level hard spending cap on Cloudflare (budget alerts are informational and arrive the next day) | AI Gateway spend limits, prepaid credits, DynamoDB counter | [#3](https://github.com/Simi24/simonepetta.com/issues/3) |
| No hard cap on AWS | the model spend is capped at the gateway; AWS infra is ~$0.5 | [#15](https://github.com/Simi24/simonepetta.com/issues/15) |
| Spend limits are eventually consistent; gateway cost estimates are best-effort | at this volume, cents | [#17](https://github.com/Simi24/simonepetta.com/issues/17) |
| Workers AI does not document EU inference | prompts are public questions on public notes | [#17](https://github.com/Simi24/simonepetta.com/issues/17) |
| Tool-use benchmarks are mostly vendor-reported, no Italian data | golden set gates the v2 launch | [#17](https://github.com/Simi24/simonepetta.com/issues/17) |
| LaTeX conversion loses silently; ~1 course in 4 needs manual work | leak detector, PDF always available | [#4](https://github.com/Simi24/simonepetta.com/issues/4) |
| Notes that copy lecturer material | per-course rights check before publishing | [#14](https://github.com/Simi24/simonepetta.com/issues/14) |
| Astro majors require migrations (about yearly) | static output does not expire; content does not depend on Astro | [#6](https://github.com/Simi24/simonepetta.com/issues/6) |

---

## 14. Build plan

Vertical slices, each deployable and each meant to be split into issues for ralph-gh. Acceptance criteria (AC) are the definition of done.

### v0: shell, readings, about

**S0 Bootstrap**
Astro skeleton, `tokens.css`, self-hosted fonts, base layout with nav and theme toggle, `wrangler.jsonc`, `site` workflow (build, deploy, PR previews), quality gates wired (axe, byte budget), Terraform base (state bucket, AWS Budget; Cloudflare: `www` redirect, DNS TXT), `AGENTS.md`, prototypes copied to `docs/prototype/`.
*AC*: an empty shell is live at simonepetta.com in both themes; a PR gets a preview URL; gates run and pass; `terraform plan` is clean.

**S1 Readings (tracer bullet)**
Content collection and schema (§6.1), `/letture/` (shelf + grouped list), post page, latest readings on the home.
*AC*: adding a `.md` makes the book appear on the shelf, in the list and (with a body) as a post; invalid frontmatter fails the build; spine height follows `pagine`; states render as bookmark/leaning.

**S2 Writing desk**
Dev-only integration (§6.4): shelf menu, add / finish / abandon / edit flows, timer, outline, grades, preview with the real post component, save.
*AC*: `/scrivi` exists under `npm run dev` and is absent from the build output; saving writes a file that passes the schema; the dev server shows it without restart; editing keeps the slug.

**S3 About, English about, colophon**
`/` and `/en/` structure (§8), `Person` JSON-LD, `hreflang`, Open Graph images.
*AC*: both pages render with the author's texts (launch waits for them); structured data validates.

**S4 Feed, SEO baseline, analytics**
`/letture/rss.xml`, sitemap with git `lastmod`, canonicals, Web Analytics snippet.
*AC*: the feed validates and contains only posts with a text; sitemap lists all pages; the beacon is the only JS on normal pages (plus the theme script).

**S5 v0 launch**
Replace `minimal-portfolio` on Vercel with a redirect-only deployment (its old content removed, the project kept alive so the `*.vercel.app` URL keeps redirecting); drop `noindex`; Search Console verified.
*AC*: the old URL redirects to simonepetta.com; the site is indexable and submitted.

### v1: notes

**S6 Notes as PDF**
`appunti/` folders, manifest schema (§7.2), derived state, `meta.json` page counts from the pipeline, PDFs copied to the output, course pages, `/appunti/` index (theses, piles, list), notice, university config, notes SEO (§12.3). Per-course rights check before adding each course (build task).
*AC*: all published courses and both theses are reachable (the author decides per course whether to publish the six barely started ones); excluded courses leave no page and no PDF; pile thickness follows page counts; scanned courses show the dashed outline.

**S7 Search**
Pagefind after `astro build`, indexing readings and notes pages, UI on `/cerca/` only.
*AC*: search on `/cerca/` finds a reading and a course page; no Pagefind JS on any other page.

**S8 Conversion pipeline**
Docker (LaTeXML via BookML), `make appunti CORSO=<slug>`, chapter pages with TOC and LaTeX conventions, Fira Math, TikZ with `currentColor`, alt text, leak detector, `appunti` workflow. First course: `GPUcomputing` (the hardest of the measured samples).
*AC*: one course is readable as HTML with the detector green; a deliberately broken input (a dropped `tikzpicture`) is caught and `build/` is not updated; the site deploy does not depend on the workflow.

**S9 Incremental conversions**
Repeatable per-course conversion, starting with the courses intended for the chat; author reviews the converted math.
*AC*: each converted course switches from PDF to HTML state with no URL change.

### v2: chat

**S10 Infrastructure**
Terraform for AWS (Lambda, DynamoDB, S3 Vectors, S3, IAM, OIDC) and Cloudflare (AI Gateway with both spend limits and Dynamic Route, Turnstile). Manual purchase of Unified Billing credits.
*AC*: `terraform plan` is clean; with a temporary tiny limit, the gateway returns `429`.

**S11 Indexing**
Pipeline step that chunks converted sections, embeds them with Cohere Embed v4 and writes S3 Vectors with a course filter; uploads section texts to S3.
*AC*: sample queries return the expected sections of a converted course.

**S12 Agent loop**
Lambda with the three tools, `max_steps`, citation enforcement, "not in your notes" answers, defensive argument validation, DynamoDB spend counter, session memory with TTL.
*AC*: invoked directly, the agent answers with valid citations, refuses correctly on absent topics, and stops at `max_steps`.

**S13 Chat Worker and page**
`workers/api`: Turnstile, signed session token, rate limiting binding, proxy to the Lambda (no streaming, §9.1); Preact island on the static chat page; collapsed trace; budget-exhausted state; `api` and `agent` workflows.
*AC*: end-to-end chat on a converted course; rate limit triggers; with the budget exhausted the page shows the paused state and the rest of the site is unaffected.

**S14 Evaluation**
Golden set (agent drafts, author reviews), `eval` workflow with a separate gateway and cap, static report page, run on primary and fallback.
*AC*: the report is published; the author records go/no-go for launch.

**S15 v2 launch**
Chat links on converted course pages.

---

## 15. Decision log

### 15.1 Tickets
| Ticket | Decision |
|---|---|
| [#2 Capire l'architettura a isole](https://github.com/Simi24/simonepetta.com/issues/2) | Islands move the default: JS without `client:*` is removed at build. Astro is the only serious candidate; the chat island can be Preact. |
| [#3 Vincoli reali di Cloudflare Pages + Workers](https://github.com/Simi24/simonepetta.com/issues/3) | Workers Static Assets, not Pages; no account hard cap; AI Gateway spend limits; v0 + v1 cost $0. |
| [#4 Pipeline LaTeX -> web e rendering della matematica](https://github.com/Simi24/simonepetta.com/issues/4) | pandoc rejected; LaTeXML via BookML; native MathML; HTML without intermediate Markdown; weeks of cost. |
| [#5 Elenco dei corsi + un corso campione](https://github.com/Simi24/simonepetta.com/issues/5) | ~25 courses + 2 theses at the time (the Overleaf export later counted 30, §7.1); each course fits in context; theses are the most valuable items. |
| [#6 Scegliere lo stack del sito](https://github.com/Simi24/simonepetta.com/issues/6) | Astro static without adapter, plain `.md`, plain CSS, npm; the chat endpoint is a separate Worker. |
| [#7 Un'origin sola o sotto-domini separati](https://github.com/Simi24/simonepetta.com/issues/7) | One origin; URL structure. |
| [#8 Dove vive e come si scrive un post di lettura](https://github.com/Simi24/simonepetta.com/issues/8) | Site and wiki independent; one `.md` per book; all books shown; half-point grades; local desk. |
| [#9 Direzione visiva del sito](https://github.com/Simi24/simonepetta.com/issues/9) | Tipografico; shelf, notebook piles, bound theses; colophon. |
| [#10 Architettura della sezione appunti (v1)](https://github.com/Simi24/simonepetta.com/issues/10) | Everything in this repo; derived state; course page in every state; leak detector; Pagefind; Fira Math. |
| [#11 Architettura della chat sugli appunti (v2)](https://github.com/Simi24/simonepetta.com/issues/11) | Per-course agent with S3 Vectors + `read_section`; no Claude; 5 EUR/month; in-page trace. |
| [#12 Struttura della spec e criterio di chiusura](https://github.com/Simi24/simonepetta.com/issues/12) | This document's shape and the cold-read closing criterion. |
| [#13 Build e deploy: Workers Builds o GitHub Actions](https://github.com/Simi24/simonepetta.com/issues/13) | GitHub Actions; posts pushed to `main`; PR previews; Terraform by hand. |
| [#14 Appunti: HTML convertito o PDF pubblicati](https://github.com/Simi24/simonepetta.com/issues/14) | All PDFs now, HTML incrementally; rights is the only exclusion. |
| [#15 AWS o Cloudflare per il carico agentico](https://github.com/Simi24/simonepetta.com/issues/15) | Agent on AWS, site on Cloudflare, Worker in front of the Lambda; the agentic reformulation. |
| [#16 La scrivania: editor locale per i post di lettura](https://github.com/Simi24/simonepetta.com/issues/16) | Dev-only `/scrivi`; shelf as menu; timer only on the first pass; editing; fixed slugs. |
| [#17 Modello economico per l'agente della chat](https://github.com/Simi24/simonepetta.com/issues/17) | DeepSeek V4 Flash on Workers AI via AI Gateway; GLM-4.7-Flash fallback; Cohere Embed v4 on Bedrock. |
| [#18 Soglie di qualità, feed, SEO e analytics](https://github.com/Simi24/simonepetta.com/issues/18) | WCAG 2.2 AA with axe in CI; byte budget; RSS for readings; Web Analytics; SEO on notes and about. |

### 15.2 Reconciliations
Found while writing this document and by the cold read (an agent with no context planning S0 and S1 from this file alone). Each item is the smallest change that makes decided tickets consistent or closes a gap with a conventional default. **All are applied in the sections above**; the author may override any of them.

**Confirmed by the author (2026-09-29)**
1. **Spine contrast**: dark mid-grey tint `#626260`, no opacity on spine text (§5.1). The prototype failed WCAG AA, which the blocking axe gate would have caught.
2. **Interface copy rule**: agents may write functional copy; first-person and author-voice copy stays a placeholder (§1.2 point 3).
3. **Sources off Overleaf now**, not at conversion time: archive repo `Simi24/appunti-sorgenti`; PDFs built locally in Docker (§7.1). Amends [#10](https://github.com/Simi24/simonepetta.com/issues/10).

**Applied by default**
4. **Theme toggle vs JS budget**: one inline theme script ≤ 1 KB is a declared budget exception (§5.1, §12.2).
5. **Readings schema**: `pagine` and `nota` added; field rules per state made explicit (§6.1).
6. **Book pages** exist only for books with a text (§3, §6.2).
7. **Page counts** in `appunti/<slug>/meta.json` for every course, not in `build/` (§7.2).
8. **Search** has its own page `/cerca/`, v1 (§3, §7.3); v0 has no search.
9. **Single endpoint**: `/api/chat` also bootstraps the session (§3).
10. **Rate limit**: the binding supports only 10 s / 60 s periods, so bursts use the binding and daily quotas use DynamoDB (§9.4).
11. **No streaming in v2**: Python Lambdas lack native response streaming (§9.1).
12. **Worker → Lambda auth**: HMAC shared secret, no AWS keys in the Worker (§9.1).
13. **Budget split**: production gateway $3.00 primary / $4.00 total, eval gateway $0.50, all within 5 EUR (§9.4).
14. **DNS**: the apex belongs to the wrangler Custom Domain; Terraform owns the other records (§10.3). Manual one-time steps are listed explicitly (§10.3).
15. **Links**: underlined in running text; navigational objects are exempt (§5.1).
16. **Dependencies**: dev tooling for `astro check` and the axe gate added; tests with `node:test` (§4.1).
17. **`appunti` workflow** always runs and exits early, so a required check never hangs (§11).
18. **Previews and pre-launch** are `noindex` and load no analytics (§11).
19. **Vercel**: redirect-only deployment instead of deleting the project (S5).
20. **This document is authoritative** for implementation; conflicts become issues (header).
21. **Prototypes** are copied to `docs/prototype/` in S0 (§14).

### 15.3 S0 prerequisites from the author
Checked on 2026-09-29:
- **Cloudflare**: the zone `simonepetta.com` is active in the author's account; it has only `vault.` and `tripla.` records (no apex, no `www`, so no conflicts; Terraform must never manage those two). The existing local `CLOUDFLARE_API_TOKEN` is zone-scoped: it reads Workers scripts and DNS but not Custom Domains, rulesets, AI Gateway, Turnstile or Web Analytics. **Needed from the author**: one token for CI from the dashboard template "Edit Cloudflare Workers", restricted to this account and zone, stored as a GitHub secret; one local-only token for Terraform with, in addition, Account: AI Gateway Edit, Turnstile Edit, Workers AI Read; Zone (`simonepetta.com`): DNS Edit, Single Redirect (Dynamic URL Redirects) Edit.
- **AWS**: profile `personale`, eu-south-1 already enabled, current spend $0, no budget yet (created in S0).
- **Search Console**: the TXT value is needed only for S5 (launch), not for S0.
- **LinkedIn**: given (§8).
Texts for the about pages and section ledes are needed before the v0 launch (S5), not before S0.
