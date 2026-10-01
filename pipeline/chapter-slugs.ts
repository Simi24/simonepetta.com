export interface ChapterRef {
  numero: number;
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

/**
 * The slug of every chapter, in order (SPEC.md §7.3): `<number>-<kebab-title>` the first time,
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
  chapters.forEach((chapter, i) => claim(i, (recorded) => recorded.numero === chapter.numero));

  const taken = new Set(reused.filter((slug): slug is string => slug !== undefined));
  return chapters.map((chapter, i) => {
    const existing = reused[i];
    if (existing !== undefined) return existing;
    const base = `${chapter.numero}-${kebabCase(chapter.titolo)}`;
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
    taken.add(slug);
    return slug;
  });
}
