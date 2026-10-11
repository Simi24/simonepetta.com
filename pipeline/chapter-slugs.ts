export interface ChapterRef {
  /** A numbered chapter. */
  numero?: number | undefined;
  /** A lettered appendix ("Appendice A"). A page with neither is unnumbered, like the acknowledgements. */
  etichetta?: string | undefined;
  titolo: string;
}

export interface RecordedChapter extends ChapterRef {
  slug: string;
}

/** Lowercase, accent-free, hyphen-separated: "Più grande, no?" becomes "piu-grande-no". */
export function kebabCase(title: string): string {
  return title
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** What identifies a page apart from its title: the chapter number or the appendix letter. */
const position = (chapter: ChapterRef): string | undefined => chapter.etichetta ?? (chapter.numero === undefined ? undefined : String(chapter.numero));

/**
 * The slug of every chapter, in order (SPEC.md §7.3): `<number>-<kebab-title>` the first time
 * (`<appendix>-<kebab-title>` for an appendix, the title alone for an unnumbered page),
 * and whatever was recorded in `build/meta.json` afterwards, so URLs never change.
 *
 * A chapter finds its recorded slug by title first (so inserting a chapter before it does not
 * hand it the wrong URL), then, among the recorded chapters no title matched, by number (so
 * renaming a chapter keeps its URL).
 */
export function assignChapterSlugs(chapters: readonly ChapterRef[], previous: readonly RecordedChapter[]): string[] {
  const claimed = new Set<number>();
  const reused: (string | undefined)[] = chapters.map(() => undefined);

  const claim = (chapterIndex: number, matches: (recorded: RecordedChapter) => boolean): void => {
    if (reused[chapterIndex] !== undefined) return;
    const recordedIndex = previous.findIndex((recorded, i) => !claimed.has(i) && matches(recorded));
    if (recordedIndex < 0) return;
    claimed.add(recordedIndex);
    reused[chapterIndex] = previous[recordedIndex]!.slug;
  };

  chapters.forEach((chapter, i) => claim(i, (recorded) => recorded.titolo === chapter.titolo));
  chapters.forEach((chapter, i) => claim(i, (recorded) => position(recorded) !== undefined && position(recorded) === position(chapter)));

  const taken = new Set(reused.filter((slug): slug is string => slug !== undefined));
  return chapters.map((chapter, i) => {
    const existing = reused[i];
    if (existing !== undefined) return existing;
    const base = [position(chapter), kebabCase(chapter.titolo)].filter((part) => part !== undefined).map((part) => kebabCase(part!)).join('-');
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
    taken.add(slug);
    return slug;
  });
}
