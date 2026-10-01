# pipeline

Conversion of a course's LaTeX to HTML chapters (SPEC.md §7.4). Run with Docker available:

```sh
npm run appunti:convert -- <slug>
```

## What a run changes

A run replaces three things in `appunti/<slug>/` **together**: `build/`, `<slug>.pdf` and `meta.json`. Everything that can fail (LaTeXML, the leak detector, the page count via `pdfinfo`) happens before the first write. A failure or a leak leaves the course exactly as it was.

## If a run was killed in the middle

The three replacements are staged next to their targets (`build.next`, `<slug>.pdf.next`, `meta.json.next`) and swapped in by renames, with a journal (`.swap-journal.json`) written first. If the process dies during the renames, the next `appunti:convert` run (for that course) recovers automatically before doing anything else:

- all new versions were already in place: the old ones (`*.old`) are deleted;
- otherwise: the old versions are put back and the `.next` leftovers deleted.

So the course is always either entirely the old conversion or entirely the new one. Nothing needs doing by hand; if it matters before the next run, the same recovery is `recoverInterruptedSwap(<course dir>)` from `course-swap.ts`. Leftover `*.next`, `*.old` or `.swap-journal.json` files in a course folder mean a run was interrupted; do not commit them.

## Files

- `Dockerfile`: TeX Live (pinned by digest) + LaTeXML + BookML (pinned, checksummed).
- `bindings/`: LaTeXML stand-ins used by the conversion only (`tcolorbox`: content and `title=` kept, styling dropped).
- `appunti-convert.ts`: the command. `appunti-build.ts` / `latexml-chapter.ts` / `chapter-slugs.ts`: LaTeXML output to fragments. `leak-detector.ts`: source against output. `appunti-install.ts` / `course-swap.ts`: the write phase. `appunti-meta.ts`: page count.
