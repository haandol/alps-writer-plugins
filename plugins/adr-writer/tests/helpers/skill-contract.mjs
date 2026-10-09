import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Read a skill's owned contract for assertions that are independent of storage.
 * Inline only explicit Markdown links into its own references/ directory, at
 * the link's position. Runtime and loading tests must read SKILL.md directly:
 * this test-only view does not imply eager reference loading by an agent.
 */
export function readSkillContract(file) {
  const root = path.dirname(file);
  if (path.basename(file) !== "SKILL.md") return readFileSync(file, "utf8");
  const seen = new Set();
  const visit = (source) => {
    if (seen.has(source)) return "";
    seen.add(source);
    return readFileSync(source, "utf8").replace(
      /\[[^\]]+\]\(([^()\s]+\.md)(?:#[^()\s]*)?\)/g,
      (link, target) => {
        const destination = path.resolve(path.dirname(source), target);
        if (!destination.startsWith(path.join(root, "references") + path.sep)) return link;
        return `${link}\n${visit(destination)}\n`;
      },
    );
  };
  return visit(path.resolve(file));
}
