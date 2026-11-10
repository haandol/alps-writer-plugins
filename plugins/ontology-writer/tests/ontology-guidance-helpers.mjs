// Fixtures that ontology-guidance.test.mjs and ontology-guidance.integration.test.mjs share.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ADR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const read = (rel) => readFileSync(path.join(ADR, rel), "utf8");

/**
 * Read the entry and its declared workflow modules, without borrowing unrelated
 * model/report guidance to satisfy a skill's own contract assertions. A moved
 * rule counts only when the entry can still reach it through a shipped link.
 */
export function workflowSources(name) {
  const sources = new Map();
  const visit = (relative) => {
    if (sources.has(relative)) return;
    const source = read(relative);
    sources.set(relative, source);
    for (const [, target] of source.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)) {
      const next = path.posix.normalize(path.posix.join(path.posix.dirname(relative), target));
      if (
        next.startsWith(`skills/${name}/references/`) ||
        ["references/change-meaning.md", "references/change-unit.md"].includes(next)
      )
        visit(next);
    }
  };
  visit(`skills/${name}/SKILL.md`);
  return sources;
}

export const workflowText = (name) => [...workflowSources(name).values()].join("\n\n");

export { EXAMPLE } from "./ontology-helpers.mjs";
