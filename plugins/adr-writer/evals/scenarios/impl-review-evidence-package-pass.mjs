import {
  settlementReviewChecks,
  settlementReviewPrompt,
} from "../lib/settlement-review-fixture.mjs";

export default {
  name: "impl-review-evidence-package-pass",
  description:
    "/adr-impl-review must return PASS without another architecture decision when every obligation is PROVEN, while still surfacing complete read-only coverage, ADR-intent fit, and a separate pre-PR comprehension check.",

  obligations: [
    {
      id: "coverage-and-verdict",
      text: "Return PASS only with D0, R1 and R2 proven from the supplied evidence. An expert report carries 1–5 questions. Keep the user-selected pre-PR quiz gate separate from the implementation verdict and from permission to publish. Explain the implementation, evidence and test result for each contract obligation without per-row approval.",
    },
    ...settlementReviewChecks,
  ],

  build(dir) {
    return settlementReviewPrompt(dir, {
      scopeAndRisk: "Duplicate and provider-failure paths determine the verdict.",
      failureTitle: "Provider failure leaves the payment pending.",
      failureOutcome:
        "Explain why failure preserves pending state and cite the supplied failure test.",
      observations:
        "The duplicate-settlement test passed: the guard returned the original result. The injected provider failure test passed: no completion was recorded. There are no confirmed findings or unverified core risks.",
      quizRequest:
        "The user selected an expert-level report and explicitly requires every prepared question to be answered correctly without consulting answers or criteria before sending a PR. Keep this opt-in publishing condition separate from the implementation verdict.",
      question: "Why does a provider failure leave the payment pending instead of completed?",
    });
  },
};
