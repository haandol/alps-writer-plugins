import path from "node:path";
const reports = [
  "../report-writer/SKILL.md",
  "../report-writer/references/explanation-design.md",
  "../report-writer/references/editorial-review.md",
  "../report-writer/references/format-and-layout.md",
];
const required = {
  "adr-sync": ["SKILL.md", ...reports],
  "adr-rollup": ["SKILL.md", "../../references/decision-reconciliation.md", ...reports],
  "adr-import": ["SKILL.md", "../../references/feature-boundaries.md", ...reports],
};
/** Check only the case's required guidance through its actual fixture read boundary before paid execution. */
export function checkRequiredGuidance(item, tools) {
  for (const relative of item.requiredGuidance ?? required[item.skill] ?? ["SKILL.md"]) {
    const file = path.posix.normalize(path.posix.join("skills", item.skill, relative));
    tools.call("read_file", { path: `plugin/${file}` });
  }
}
