import { skillText, seedRuleDocs, seedMapping, TAIL_SPEC } from "../lib/harness.mjs";

export default {
  name: "impl-review-comprehension-retry",
  description:
    "A wrong comprehension answer must keep the implementation PASS, explain the missing concept with evidence, retry the same question, and keep the PR not ready.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      skillText("adr-impl-review"),
      `\n---\n\n# This run`,
      `The implementation review verdict is PASS and every contract row is PROVEN.`,
      `There is one prepared comprehension question:`,
      `Q1: Why does provider failure leave the payment pending instead of completed?`,
      `Stored answer criteria: a successful provider result must cross the idempotent completion boundary before completion is recorded.`,
      `Stored evidence: ADR R2 and the provider-failure test.`,
      `The user explicitly requested the interactive comprehension check and then answered:`,
      `"Because the retry delay is 250 ms."`,
      `Respond as the interactive comprehension step after grading this answer.`,
      `Keep the implementation verdict unchanged. If the answer is wrong, say the PR is not comprehension-ready, explain the missing concept using the evidence, and retry Q1 rather than creating a new question.`,
      `In EVAL-FINDINGS include exactly:`,
      `QUIZ_RESULT | question=Q1; correct=false; prReady=false; retry=Q1; verdict=PASS`,
      TAIL_SPEC,
    ].join("\n");
  },
};
