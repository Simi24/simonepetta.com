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

## The saved view

After a save the page shows the file that was written (`client/saved-view.ts`). That page is not the one
the save's response reaches: the reload described above can replace it first. So the page notes in
`sessionStorage` that it expects a saved view, with an id it also sends with the save. The next page to
load reads and clears the note, and draws the view only if `GET /__scrivania/save` (the last save, kept by
`request-handler.ts`) echoes the same id; otherwise it shows the shelf. A failed save clears the note.

## Which file an edit writes

An entry's id is not always its file name (a hand-made `Il Nome.md` has the id `il-nome`). The page
embeds each entry's file name and an edit sends it back; `entry-file.ts` accepts it only if it is one of
the content directory's own `.md` files, and the path is built from that listing, never from the request.
