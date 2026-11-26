// The explicitly requested interactive comprehension check grades the answer
// against the stored criteria without changing the implementation verdict: a
// wrong answer keeps the PR not comprehension-ready and retries the same
// question, while a correct final answer makes it ready. Both directions run
// in one probe over the same question, criteria and evidence.
import { skillText, seedRuleDocs, seedMapping, TAIL_SPEC } from "../lib/harness.mjs";

export const obligations = [
  {
    id: "wrong-answer",
    text: "Session A's answer is graded incorrect: the reply says the PR is not comprehension-ready, explains the missing concept (provider success must cross the idempotent completion boundary before completion is recorded) with the stored evidence, and retries Q1 instead of creating a new question.",
  },
  {
    id: "correct-answer",
    text: "Session B's answer is graded correct because it states the required concept and causal relationship, and the PR is marked comprehension-ready only after that final correct answer.",
  },
  {
    id: "verdict",
    text: "In both sessions the implementation verdict stays PASS and every contract row stays PROVEN; the reply neither reopens an ADR decision nor changes lifecycle state.",
  },
];

export default {
  name: "impl-review-comprehension-grading",
  description:
    "The requested interactive comprehension check retries the same question and keeps the PR not ready after a wrong answer, marks it ready only after a correct final answer, and never changes the implementation verdict.",

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
      ``,
      `Two independent sessions each explicitly requested the interactive comprehension check and answered Q1:`,
      `Session A: "Because the retry delay is 250 ms."`,
      `Session B: "Completion is written only after a successful provider result crosses the idempotent completion boundary, so a provider failure leaves the payment pending."`,
      ``,
      `Write the interactive comprehension step you would send in each session after grading its answer, labeled Session A and Session B.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
