import { hookContext, ruleText, seedRuleDocs, TAIL_SPEC } from "../lib/harness.mjs";

export default {
  name: "hook-admission-routing",
  description:
    "The emitted SessionStart directive must route a requirement-value change ADR-first while leaving a replaceable SDK swap at code level.",

  build(dir) {
    seedRuleDocs(dir);
    const directive = hookContext(dir);
    return [
      directive,
      `\n---\n\n# Reference vocabulary`,
      ruleText("concepts.md"),
      `\n---\n\n# This run`,
      `Classify both requests independently:`,
      `A. Keep the Bedrock provider/model and fallback unchanged; replace only the SDK and credential adapter.`,
      `B. Change the free-plan upload quota from 5 per month to 3 per month.`,
      `Do not execute either request. State the route only.`,
      `Use EXEMPT for code-level work and ADR_FIRST for admitted work in the tail.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
