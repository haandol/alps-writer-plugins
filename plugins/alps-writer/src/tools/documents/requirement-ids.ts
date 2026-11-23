import { REQUIREMENT_PREFIXES, type RequirementPrefix } from "../../profiles.js";

const PREFIX_GROUP = REQUIREMENT_PREFIXES.join("|");

// A complete identifier token: FR-1 never matches inside FR-10, NFR-1 or XFR-1.
const TOKEN = new RegExp(`(?<![A-Za-z0-9])(${PREFIX_GROUP})-([1-9]\\d*)(?![A-Za-z0-9])`, "g");

// A definition starts a table row's first cell, a list item or a heading, optionally
// wrapped in emphasis or code, so references in later cells or prose never define.
const DEFINITION = new RegExp(
  `^\\s*(?:\\|\\s*|[-*+]\\s+|\\d+[.)]\\s+|#{1,6}\\s+)?(?:\\*\\*|__|\`)?(${PREFIX_GROUP})-([1-9]\\d*)(?![A-Za-z0-9])`,
);

const withoutCodeFences = (text: string): string =>
  text.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, "");

/** Every complete requirement identifier token referenced in the text. */
export function requirementReferences(text: string): Set<string> {
  return new Set([...text.matchAll(TOKEN)].map((match) => `${match[1]}-${match[2]}`));
}

/**
 * Identifiers defined in one owning subsection, counted per occurrence so a
 * duplicate definition can be rejected. Only the owned prefixes define here.
 */
export function requirementDefinitions(
  text: string,
  owned: readonly RequirementPrefix[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const line of withoutCodeFences(text).split(/\r?\n/)) {
    const match = line.match(DEFINITION);
    if (!match || !owned.includes(match[1] as RequirementPrefix)) continue;
    const id = `${match[1]}-${match[2]}`;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** Sort identifiers by prefix order, then number. */
export function sortRequirementIds(ids: Iterable<string>): string[] {
  const rank = (id: string) => REQUIREMENT_PREFIXES.indexOf(id.split("-")[0] as RequirementPrefix);
  return [...ids].sort(
    (a, b) => rank(a) - rank(b) || Number(a.split("-")[1]) - Number(b.split("-")[1]),
  );
}
