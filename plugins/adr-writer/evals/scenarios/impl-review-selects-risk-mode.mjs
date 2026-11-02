import { skillText, seedRuleDocs, seedMapping, TAIL_SPEC } from "../lib/harness.mjs";

export default {
  name: "impl-review-selects-risk-mode",
  description:
    "/adr-impl-review must choose standard for a localized implementation cleanup and full for requirement/public-contract changes.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      skillText("adr-impl-review"),
      `\n---\n\n# This run`,
      `Classify these two review scopes without executing them:`,
      `A. Replace two identical private parsing blocks with one local helper. Public behavior,`,
      `requirements, schema, state, permissions, errors, concurrency, and dependencies are unchanged.`,
      `B. Change retention from 30 to 90 days and add a field to the public API response.`,
      `Use STANDARD and FULL as finding tags and include the scope letter in each summary.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
