export interface Tag {
  name: string;
  attrs: Record<string, string>;
  /** Text between this opening tag and its closing tag (no nested elements assumed). */
  text: string;
}

/** Every `<tag ... class="... cls ...">text</tag>` in `html`, with attributes in any order. */
export function tagsWithClass(html: string, cls: string): Tag[] {
  const tags: Tag[] = [];
  for (const match of html.matchAll(/<(\w+)((?:\s+[\w:-]+(?:="[^"]*")?)*)\s*>([^<]*)<\/\1>/g)) {
    const attrs: Record<string, string> = {};
    for (const attr of match[2]!.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) attrs[attr[1]!] = attr[2] ?? '';
    if ((attrs['class'] ?? '').split(/\s+/).includes(cls)) tags.push({ name: match[1]!, attrs, text: match[3]! });
  }
  return tags;
}

export interface OpeningTag {
  name: string;
  attrs: Record<string, string>;
  /** The tag's position in `html`, to slice the element's content from. */
  index: number;
  raw: string;
}

/** Every opening tag whose class list contains `cls`, with attributes in any order. */
export function openingTagsWithClass(html: string, cls: string): OpeningTag[] {
  const tags: OpeningTag[] = [];
  for (const match of html.matchAll(/<(\w+)((?:\s+[\w:-]+(?:="[^"]*")?)*)\s*>/g)) {
    const attrs: Record<string, string> = {};
    for (const attr of match[2]!.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) attrs[attr[1]!] = attr[2] ?? '';
    if ((attrs['class'] ?? '').split(/\s+/).includes(cls))
      tags.push({ name: match[1]!, attrs, index: match.index, raw: match[0] });
  }
  return tags;
}
