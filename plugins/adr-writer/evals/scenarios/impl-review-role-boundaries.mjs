import { agentText, seedRuleDocs, seedMapping, TAIL_SPEC } from "../lib/harness.mjs";

export default {
  name: "impl-review-role-boundaries",
  description:
    "Explainer and necessity roles must preserve their distinct observable responsibilities without requiring a fixed agent count.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      agentText("adr-impl-explainer"),
      `\n---\n`,
      agentText("adr-impl-necessity-reviewer"),
      `\n---\n# This run`,
      `Describe the two role boundaries and how the caller may execute them.`,
      `Do not call tools.`,
      `Use EXPLAIN_NO_JUDGMENT, NECESSITY_ONLY, and ORCHESTRATION_DISCRETION as tail tags.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
