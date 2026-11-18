import {
  settlementReviewChecks,
  settlementReviewPrompt,
} from "../lib/settlement-review-fixture.mjs";

export default {
  name: "impl-review-evidence-package-unverified",
  description:
    "/adr-impl-review must return INCONCLUSIVE for a material UNVERIFIED obligation while presenting complete coverage and ADR-intent fit without per-row approval.",

  obligations: [
    {
      id: "coverage-and-verdict",
      text: "Return INCONCLUSIVE for the missing provider-failure evidence. Keep the proven duplicate-settlement path distinct from D0 and R2’s unverified coverage. The beginner report carries 1–10 questions and no publishing gate was selected. Explain the implementation, evidence and test result for each contract obligation without per-row approval.",
    },
    ...settlementReviewChecks,
  ],

  build(dir) {
    return settlementReviewPrompt(dir, {
      scopeAndRisk:
        "Duplicate settlement passed while provider-failure verification remains unavailable.",
      failureTitle: "Provider failure remains the important unknown.",
      failureOutcome:
        "Explain the failure branch and distinguish its intended pending outcome from the unexecuted failure test.",
      observations:
        "The duplicate-settlement test passed: the guard returned the original result. Provider failure injection was unavailable, so the pending outcome was not verified. No code defect was confirmed.",
      quizRequest:
        "The user selected a beginner-level report with no PR comprehension gate. Keep the self-check separate from publishing permission and repository checks.",
      question:
        "What remains unknown about provider failure, and why does that prevent a complete review verdict?",
    });
  },
};
