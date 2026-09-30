/**
 * Serializes a value for inlining into `<script type="application/ld+json">`. Escapes every
 * `<` (as its JSON unicode escape, still valid JSON) so no string value can close the tag
 * early with a literal `</script>`.
 */
export function serializeJsonLd(value: object): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
