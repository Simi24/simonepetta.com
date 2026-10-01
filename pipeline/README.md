# pipeline

Conversion of a course's LaTeX to HTML chapters (SPEC.md §7.4). Run with Docker available:

```sh
npm run appunti:convert -- <slug>
```

## What a run changes

A run replaces three things in `appunti/<slug>/` **together**: `build/` (chapter fragments and `figure/`, the re-encoded images), `<slug>.pdf` and `meta.json`. Everything that can fail (LaTeXML, the leak detector, the page count via `pdfinfo`) happens before the first write. A failure or a leak leaves the course exactly as it was.

## If a run was killed in the middle

The three replacements are staged next to their targets (`build.next`, `<slug>.pdf.next`, `meta.json.next`) and swapped in by renames, with a journal (`.swap-journal.json`) written first. If the process dies during the renames, the next `appunti:convert` run (for that course) recovers automatically before doing anything else:

- all new versions were already in place: the old ones (`*.old`) are deleted;
- otherwise: the old versions are put back and the `.next` leftovers deleted.

So the course is always either entirely the old conversion or entirely the new one. Nothing needs doing by hand; if it matters before the next run, the same recovery is `recoverInterruptedSwap(<course dir>)` from `course-swap.ts`. Leftover `*.next`, `*.old` or `.swap-journal.json` files in a course folder mean a run was interrupted; do not commit them.

## Figures

Raster images are re-encoded to WebP (at most 1600 px wide) and TikZ pictures compiled to SVG inside the container (`figures.sh`); the descriptions come from `appunti/<slug>/src/alt.json`, keyed by the image path (`images/a.png`) or the TikZ file and index (`img/up.tex#1`). A figure without a description fails the conversion: the message lists them, you open each figure, add its entry (Italian, factual, from the caption and what the image shows) and run again. Macros a TikZ picture uses must be one line each in `main.tex`'s preamble.

## Checks in CI (the `appunti` workflow)

`npm run test:pipeline` runs the pipeline's unit tests (list the new pipeline test files in that script). `node pipeline/appunti-check.ts` needs neither Docker nor LaTeX: for each published course it checks that `meta.json` matches the PDF's page count (`pdfinfo`) and, for a converted course, runs the leak detector on the committed `build/` against `src/`. It fails when it checks no course at all. A committed `build/` no longer records the tcolorboxes or LaTeXML's error count, so those two are checked only when converting. The `appunti` workflow's manual run (`workflow_dispatch`, input: the course slug) re-converts that course in Docker and fails if `build/` or `meta.json` differ from what is committed, uploading the diff; the PDF is not compared (LaTeX embeds timestamps), only its page count through `meta.json`.

## Files

- `Dockerfile`: TeX Live (pinned by digest; its `dvisvgm` compiles TikZ) + LaTeXML + BookML (pinned, checksummed) + ImageMagick and `webp` (image re-encoding).
- `bindings/`: LaTeXML stand-ins used by the conversion only (`tcolorbox`: content and `title=` kept, styling dropped).
- `appunti-convert.ts`: the command. `appunti-build.ts` / `latexml-chapter.ts` / `chapter-slugs.ts`: LaTeXML output to fragments. `leak-detector.ts`: source against output. `appunti-install.ts` / `course-swap.ts`: the write phase. `appunti-meta.ts`: page count. `figures.sh` / `figures-docker.ts` / `figure-sources.ts` / `raster-plan.ts` / `alt-text.ts` / `figures.ts`: figures (container step, source scanning, naming, descriptions, HTML rewriting).
