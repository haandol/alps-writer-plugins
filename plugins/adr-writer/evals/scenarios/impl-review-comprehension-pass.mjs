import { responseChecks } from "../lib/response-checks.mjs";

export const obligations = [
  {
    id: "understanding",
    text: "Recognize the supplied final Q1 answer as correct because it explains that provider success must cross the idempotent completion boundary before recording completion. Mark PR comprehension readiness as ready only after this final correct answer; equivalent readiness wording is accepted.",
  },
  {
    id: "verdict",
    text: "Keep the implementation verdict PASS and every contract row PROVEN unchanged, disclose the stored evidence, and do not reopen an ADR decision or modify lifecycle state. Return the requested QUIZ_RESULT with question=Q1, correct=true, prReady=true, verdict=PASS.",
  },
];

/** Enforce exact response records and no fixture mutation, independently of prose. */
export function deterministicScore(input) {
  return responseChecks(
    input,
    { QUIZ_RESULT: ["question", "correct", "prReady", "verdict"] },
    { noTools: false },
  );
}

import { skillText, seedRuleDocs, seedMapping, TAIL_SPEC } from "../lib/harness.mjs";

export default {
  name: "impl-review-comprehension-pass",
  description:
    "The PR becomes comprehension-ready only after the final prepared question is answered with the required concept and causal relationship.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      skillText("adr-impl-review"),
      `\n---\n\n# This run`,
      `The implementation review verdict is PASS and every contract row is PROVEN.`,
      `Q1 is the only prepared comprehension question:`,
      `Why does provider failure leave the payment pending instead of completed?`,
      `Stored answer criteria: a successful provider result must cross the idempotent completion boundary before completion is recorded.`,
      `Stored evidence: ADR R2 and the provider-failure test.`,
      `The user explicitly requested the interactive comprehension check and then answered:`,
      `"Completion is written only after a successful provider result crosses the idempotent completion boundary, so a provider failure leaves the payment pending."`,
      `Respond as the interactive comprehension step after grading this final answer.`,
      `Keep the implementation verdict unchanged. Mark the PR comprehension-ready only if the answer contains the required concept and causal relationship.`,
      `In EVAL-FINDINGS include exactly:`,
      `QUIZ_RESULT | question=Q1; correct=true; prReady=true; verdict=PASS`,
      TAIL_SPEC,
    ].join("\n");
  },
};
