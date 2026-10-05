const FEATURE_ID = /\bF(?:[1-9]\d*|(?:-[A-Z0-9]+)+)\b/gi;

const ids = (text: string): string[] => [
  ...new Set((text.match(FEATURE_ID) ?? []).map((id) => id.toUpperCase())),
];

const plain = (text: string): string => text.replace(/[*_`]/g, "").trim();

/**
 * Match declared features to nonempty specifications, never substitute an
 * unrelated entry for a missing feature. Explicit identity comes from the
 * title or Feature ID header, not references inside flows or examples.
 */
export function featureCoverage(
  source: string,
  entries: ReadonlyMap<string, { title: string; content: string }>,
): { expected: number; written: number; missing: string[] } {
  const required = ids(source);
  const counts = new Map<string, number>();
  const names = new Map<string, string>();
  for (const line of source.split(/\r?\n/)) {
    const boldDeclaration = line.match(
      /(?:\*\*|__)(F(?:[1-9]\d*|(?:-[A-Z0-9]+)+)\s*:[\s\S]*?)(?:\*\*|__)/i,
    );
    const normalized = plain(boldDeclaration?.[1] ?? line);
    const declaration = normalized.match(
      /^\s*(?:\|\s*|[-+]\s*|\d+[.)]\s*)?(F(?:[1-9]\d*|(?:-[A-Z0-9]+)+))\s*(?:\|\s*([^|]+)|:\s*(.+))/i,
    );
    if (declaration) {
      names.set(declaration[1].toUpperCase(), (declaration[2] ?? declaration[3]).trim());
    }
  }

  for (const [sectionId, entry] of entries) {
    if (!entry.content.trim()) continue;
    const titleIds = ids(entry.title);
    const headerIds = ids(
      entry.content
        .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, "")
        .split(/\r?\n/)
        .filter((line) => /^\s*(?:#{1,6}\s*)?(?:\*\*|__)?Feature ID\s*:/i.test(line))
        .map((line) => line.split("|")[0])
        .join("\n"),
    );
    const explicit = [...new Set([...titleIds, ...headerIds])];
    if (explicit.length > 1) continue;
    const ordinal = `F${sectionId.split(".").at(-1)}`;
    const namedMatches = [...names].filter(([, name]) => name === plain(entry.title));
    const id =
      explicit[0] ??
      (required.includes(ordinal)
        ? ordinal
        : namedMatches.length === 1
          ? namedMatches[0][0]
          : ordinal);
    if (!required.includes(id)) continue;
    // Numeric feature IDs have a matching 7.x slot. Named IDs use their
    // explicit identity, since their name does not encode a subsection index.
    if (/^F\d+$/.test(id) && id !== ordinal) continue;
    if (!explicit.length && names.has(id) && plain(entry.title) !== names.get(id)) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const missing = required.filter((id) => counts.get(id) !== 1);
  return { expected: required.length, written: required.length - missing.length, missing };
}
