import { STAMPED_RULE_DOCS } from "../../scripts/adr-lint-lib.mjs";

const MUTATIONS = new Set(["write_file", "delete_file", "move_file", "demote_adr_status"]);

/** Seeded rules are scaffolding, not documents adopted by an import run. */
export function officialAdrFiles(files = {}) {
  return Object.fromEntries(
    Object.entries(files).filter(
      ([file]) =>
        file.startsWith("docs/adr/") &&
        !STAMPED_RULE_DOCS.some((name) => file === `docs/adr/${name}`),
    ),
  );
}

/** Leave approval and timing checks with each scenario's own verifier. */
export function mutationRequests(events) {
  return events.filter((event) => event.kind === "request" && MUTATIONS.has(event.tool));
}

/** Read the body without its heading; an absent section stays undefined. */
export function sectionText(section) {
  return section?.lines
    .slice(section.start + 1, section.end)
    .join("\n")
    .trim();
}
