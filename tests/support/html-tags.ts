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
