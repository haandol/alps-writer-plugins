import { responseChecks } from "../lib/response-checks.mjs";

export const obligations = [
  {
    id: "delivery",
    text: "Keep the Feature and its single ADR decision intact. Offer dependency-ordered cumulative Stacked PR delivery steps, each answering a conceptual review question and preserving the same contract. Do not split by technical layer.",
  },
  {
    id: "scope",
    text: "Keep the Stack plan ephemeral, create no branch or PR, and make publishing depend on an explicit user request and available GitHub capability. No layer alone promotes the ADR: keep Proposed until the entire implementation and final review pass, then transition to Accepted. All requested tail items agree with the visible plan.",
  },
];

/** Enforce exact response records and no fixture mutation, independently of prose. */
export function deterministicScore(input) {
  return responseChecks(
    input,
    {
      KEEP_ONE_ADR: [],
      STACK_FALLBACK: [],
      STACK_BOUNDARY: [],
      EPHEMERAL: [],
      NO_AUTOPUBLISH: [],
      STATUS_LIFECYCLE: [],
    },
    { noTools: false },
  );
}

import { skillText, seedRuleDocs, seedMapping, TAIL_SPEC } from "../lib/harness.mjs";

export default {
  name: "impl-offers-stacked-pr-fallback",
  description:
    "When the user requests lower review load but one Feature and one ADR must stay intact, adr-impl may offer an ephemeral dependency-ordered Stacked PR delivery plan without publishing it.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      skillText("adr-impl", { references: ["skills/adr-impl/references/planning.md"] }),
      `\n---\n\n# This run`,
      `The approved ADR contains one architectural decision: payment idempotency across the`,
      `checkout state flow, provider call, ledger transaction, and duplicate webhook handling.`,
      `The Feature is one observable checkout behavior and the ADR cannot be split into independent`,
      `decisions without duplicating the contract or dividing the vertical slice by technical layer.`,
      `The user explicitly asks to reduce review load and is open to multiple PRs.`,
      `Decide how to decompose delivery, but do not create branches or publish PRs in this run.`,
      `Use KEEP_ONE_ADR, STACK_FALLBACK, STACK_BOUNDARY, EPHEMERAL, NO_AUTOPUBLISH,`,
      `and STATUS_LIFECYCLE finding tags.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
