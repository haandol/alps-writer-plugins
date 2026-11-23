import { REQUIREMENT_PREFIXES, type RequirementPrefix } from "../../profiles.js";
import { scanFences } from "./fences.js";

const PREFIX_GROUP = REQUIREMENT_PREFIXES.join("|");

// A complete identifier token: FR-1 never matches inside FR-10, NFR-1 or XFR-1.
const TOKEN = new RegExp(`(?<![A-Za-z0-9])(${PREFIX_GROUP})-([1-9]\\d*)(?![A-Za-z0-9])`, "g");

// A definition starts a table row's first cell, a list item or a heading, optionally
// wrapped in emphasis or code. An identifier anywhere else is a reference.
const STRUCTURAL_DEFINITION = new RegExp(
  `^\\s*(?:\\|\\s*|[-*+]\\s+|\\d+[.)]\\s+|#{1,6}\\s+)(?:\\*\\*|__|\`)?(${PREFIX_GROUP})-([1-9]\\d*)(?![A-Za-z0-9])`,
);

// A bold line acting as a heading also defines: the bold span starts with the identifier
// (`**FR-1: Merge the cart**`, `**FR-1**`), and after it closes the line holds at most a short
// parenthetical and then ends or continues after a colon or dash, as in
// `**FR-1: Merge the cart** (Required) — Given …` or `**FR-1**: Merge the cart`.
// A bold identifier or noun phrase that opens a sentence (`**FR-2 checkout** is redefined
// later`) is a reference.
const BOLD_HEADING_DEFINITION = new RegExp(
  `^\\s*(\\*\\*|__)(${PREFIX_GROUP})-([1-9]\\d*)(?![A-Za-z0-9])(?:(?!\\1).)*\\1\\s*(?:\\([^()]*\\))?\\s*(?:[:：\\-–—].*)?$`,
);

/** The identifier a line defines, if the line is a definition position. */
function definedIdentifier(line: string): { prefix: string; id: string } | null {
  const structural = line.match(STRUCTURAL_DEFINITION);
  if (structural) return { prefix: structural[1], id: `${structural[1]}-${structural[2]}` };
  const heading = line.match(BOLD_HEADING_DEFINITION);
  return heading ? { prefix: heading[2], id: `${heading[2]}-${heading[3]}` } : null;
}

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
  for (const line of scanFences(text).outside) {
    const definition = definedIdentifier(line);
    if (!definition || !owned.includes(definition.prefix as RequirementPrefix)) continue;
    counts.set(definition.id, (counts.get(definition.id) ?? 0) + 1);
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
