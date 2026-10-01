# The writing desk (dev only)

`/scrivi/` and its save and preview endpoints exist only under `astro dev` (SPEC.md §6.4).

## After a save

`onSaved` (`index.ts`) refreshes the content collection, then waits until `/scrivi/` itself serves the
saved book (`served.ts`, up to about 2 s). `refreshContent` resolves a few milliseconds before the dev
server's render path sees the new content, and the sheet navigates to the shelf the moment the save
responds. If the shelf never shows it, the save responds with a `warning` and the sheet surfaces it.

## Several tabs

Astro's dev server sends `full-reload` to every open page each time the content store is written, so a
save in one tab reloads the others. An open sheet with unsaved text goes through its `beforeunload` guard:
the browser asks, cancelling keeps the text, leaving discards it. Pinned by the spec "a save in another
tab reloads the open sheet only through the unsaved-text guard".
