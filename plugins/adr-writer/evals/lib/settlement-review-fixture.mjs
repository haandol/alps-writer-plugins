import { agentText, seedMapping, seedRuleDocs, skillText, TAIL_SPEC, write } from "./harness.mjs";

const ADR = `# ADR 0001: idempotent payment settlement

Date: 2026-08-17

## Status

Accepted (2026-08-17)

## Context

Payment settlement must remain consistent across duplicate requests and provider failure.

## Decision Drivers

- Duplicate requests must not create duplicate completion.
- Provider failure must preserve pending state.
- Review evidence must remain implementation-independent.

## Decision

Payment settlement uses an idempotent completion boundary and preserves the pending state on provider failure.

### Requirement contract

- A payment is completed at most once.
- Provider failure never records payment completion.

### Alternatives

- Guard settlement at the completion boundary.
- Reconcile duplicates after completion.

## Consequences

Settlement requires duplicate and provider-failure verification.

## Related

- 없음
`;

export const settlementReviewChecks = [
  {
    id: "implementation-choice",
    text: "Keep the 250 ms retry delay as a read-only implementation choice and explain its observed basis, intent fit and operational impact.",
  },
  {
    id: "narrative-and-evidence",
    text: "Use the native Markdown anchors and placeholders, show both vertical flows and the provider sequence with its limit, keep coverage and choices read-only, and use only the supplied code excerpts and test observations. Include findings before detailed evidence, without inventing executions.",
  },
  {
    id: "reader-check",
    text: "Keep answers and grading evidence hidden before self-check, offer recall before choices, mark one or two questions for later review, and keep progress off disk. Quiz inclusion does not start interactive grading.",
  },
];

/** Both verdict probes start from the same accepted decision and shipped review guidance. */
export function settlementReviewPrompt(
  dir,
  { observations, scopeAndRisk, failureTitle, failureOutcome, quizRequest, question },
) {
  seedRuleDocs(dir);
  write(dir, "docs/adr/payments/settlement/0001-idempotent-payment-settlement.md", ADR);
  seedMapping(dir, {
    categories: {
      "payments/settlement": {
        feature: "Payment settlement",
        adrs: [
          {
            path: "docs/adr/payments/settlement/0001-idempotent-payment-settlement.md",
            status: "Accepted (2026-08-17)",
            summary:
              "Payment settlement is idempotent and preserves pending state on provider failure",
          },
        ],
        dependsOn: [],
      },
    },
  });
  const implementation = [
    "export async function settle(id, ledger, provider) {",
    "  const completed = await ledger.completed(id);",
    "  if (completed) return completed;",
    "  const result = await provider.settle(id);",
    "  return ledger.completeOnce(id, result);",
    "}",
  ];
  write(dir, "src/settlement.mjs", implementation.join("\n") + "\n");
  return [
    skillText("adr-impl-review", {
      references: [
        "skills/adr-impl-review/references/full-review.md",
        "skills/adr-impl-review/references/evidence-synthesis.md",
      ],
    }),
    agentText("adr-impl-review-report-writer", {
      references: [
        "skills/adr-impl-review/references/artifact-contract.md",
        "skills/adr-impl-review/references/artifact-schema.md",
        "skills/adr-impl-review/references/review-hiking.md",
        "skills/adr-impl-review/references/quiz-artifact.md",
        "references/review-report-writing.md",
        "skills/adr-impl-review/references/visualization.md",
      ],
    }),
    "# This run",
    "Prepare implementation-review.md, the native audit source for a completed synthetic review. Use its required headings and generated placeholders. The underlying evidence is supplied below. Do not claim to have executed these checks.",
    "D0: an idempotent completion boundary preserves pending state on provider failure. R1: repeated requests leave one completed payment. R2: a failed provider call leaves the payment pending.",
    "Context fields: Payment settlement preserves one durable result. / Payment settlement receives retries and provider outcomes. / One completion boundary preserves idempotency and pending state. / " +
      scopeAndRisk,
    "H1 heading: A retry reaches the idempotent boundary. Vertical slice: user-flow / Duplicate payment settlement. Explain the guard, its caller and the one-completion outcome.",
    "H2 heading: " +
      failureTitle +
      " Vertical slice: user-flow / Provider failure settlement. " +
      failureOutcome,
    "For each Hill, use Component C1 for its focused code evidence. Use the supplied change to src/settlement.mjs, with the retry guard in H1 and the provider/commit sequence in H2:",
    "```diff",
    "--- a/src/settlement.mjs",
    "+++ b/src/settlement.mjs",
    "@@ -1,3 +1,6 @@",
    " " + implementation[0],
    "-  return ledger.complete(id, await provider.settle(id));",
    ...implementation.slice(1, -1).map((line) => "+" + line),
    " }",
    "```",
    "Inside H2, show the provider request, success and failure branches in V1 (sequenceDiagram) with its required marker and Notice. Distinguish the code path from the test result. Keep findings before detailed evidence and preserve each D0/R1/R2 status, implementation basis, evidence and tests.",
    "The separate retry scheduler uses a fixed 250 ms delay. The ADR leaves timing open. The delay keeps retries bounded and affects recovery latency and upstream request rate.",
    observations,
    quizRequest,
    "Include this prepared question: " + question,
    "Keep the hidden answer, grading evidence and full native coverage in the structured handoff. The materializer supplies the Markdown tables and visible prompts.",
    TAIL_SPEC,
  ].join("\n");
}
