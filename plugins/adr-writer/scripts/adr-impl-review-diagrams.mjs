// Share official Mermaid validation and rendering with the standalone report skill.
export * from "../skills/report-writer/scripts/mermaid.mjs";
import { parseMermaidAll } from "../skills/report-writer/scripts/mermaid.mjs";

/** Parse unambiguous required figures together. Callers still diagnose missing or duplicate fences. */
export function indexReviewDiagrams(blocks, requirements) {
  const byId = Map.groupBy(blocks, (block) => block.requirementId);
  const sources = [];
  for (const requirement of requirements) {
    const matches = byId.get(requirement.id);
    if (matches?.length === 1 && matches[0].closed) sources.push(matches[0].source);
  }
  parseMermaidAll(sources);
  return byId;
}
