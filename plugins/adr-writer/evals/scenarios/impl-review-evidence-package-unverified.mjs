import {
  agentText,
  skillText,
  seedRuleDocs,
  seedMapping,
  TAIL_SPEC,
  write,
} from "../lib/harness.mjs";

const CASE = `
The approved ADR has one Decision and two independent requirement-contract obligations:

1. D0 Decision: Payment settlement uses an idempotent completion boundary and preserves
   the pending state on provider failure.
2. R1: A payment is completed at most once.
   Observable evidence: repeating the same settlement request leaves one completed payment.
3. R2: Provider failure never records payment completion.
   Observable evidence: a failed provider call leaves the payment pending.

The implementation review found:

- The Decision is only partly verified because its provider-failure half could not run.
- Obligation 1 is supported by an idempotency guard and a passing duplicate-settlement test.
- Obligation 2 could not be executed because provider failure injection is unavailable.
- The ADR did not specify retry timing. The code chose a fixed 250 ms delay. This remains
  below ADR resolution, keeps retries bounded, preserves the failure result, and affects
  recovery latency and upstream request rate.
- There are no confirmed code defects.
`;
const PR_GUIDANCE =
  "Do not open or send the PR until every comprehension question is answered correctly without reading the answer criteria.";
const QUIZ_QUESTION =
  "What remains unknown about provider failure, and why does that prevent a complete review verdict?";

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

export default {
  name: "impl-review-evidence-package-unverified",
  description:
    "/adr-impl-review must return INCONCLUSIVE for a material UNVERIFIED obligation while presenting complete coverage and ADR-intent fit without per-row approval.",

  build(dir) {
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
      `\n---\n\n# This run`,
      `Produce the concise human-facing Evidence Package for this completed review.`,
      `The normal response is the narrative source for implementation-review.md,`,
      `starting with "# ADR implementation review" and including every required core heading.`,
      `Under At a glance, ADR contract coverage, Notable implementation choices, and Comprehension check, write only <!-- generated from findings.json -->.`,
      `Do not put conversational prose before or instead of the report file contents.`,
      `Do not invent files or tests beyond the facts below. Show the normal response first.`,
      `The normal response must lead with At a glance (Verdict, Impact, Action, Risk),`,
      `then Context, these exact Container/Hills with Components and Code, findings, contract coverage, notable implementation choices, residual risks, and Comprehension check.`,
      `Under Context write only <!-- generated review context from findings.json -->.`,
      `Context fields must be exactly: Payment settlement preserves one durable result. / Payment settlement receives retries and provider outcomes. / One completion boundary preserves idempotency and pending state. / Duplicate settlement passed while provider-failure verification remains unavailable.`,
      `Hill H1 heading: A retry reaches the idempotent boundary.`,
      `Hill H1 vertical slice must be user-flow / Duplicate payment settlement.`,
      `Hill H1 Container must explain retry responsibility, interactions, and one-completion outcome. Component C1 must explain the idempotent boundary and include focused diff Code evidence.`,
      `Hill H2 heading: Provider failure remains the important unknown.`,
      `Hill H2 vertical slice must be user-flow / Provider failure settlement.`,
      `Hill H2 Container must explain provider-failure responsibility, interactions, and unverified pending outcome. Component C1 must explain the failure branch and include focused diff Code evidence.`,
      `Put <!-- generated container zoom from findings.json --> and <!-- generated component zoom from findings.json --> once after each Hill question.`,
      `Put <!-- generated hill evidence from findings.json --> once after each Hill Components block.`,
      `Inside H2 include V1 sequenceDiagram showing the provider request, successful response and failure branch with the pending outcome. A separate state diagram is not needed. Include %% requirement: V1 and a following Notice: sentence. Draw the supplied code path; do not claim an unexecuted path was verified.`,
      `Follow the verified settlement or trust-boundary flow where it helps. Do not default to implementation order.`,
      `Remove repeated contrast templates, ornamental one-off labels, forced numbered symmetry, filler bridges, and duplicate visuals. Do not invent a story.`,
      `Coverage and choices are read-only.`,
      `The visible Comprehension check must include 1-5 medium-difficulty four-option single-answer questions and this exact guidance: ${PR_GUIDANCE}`,
      `Include this question exactly: ${QUIZ_QUESTION}`,
      `Do not reveal the answer criteria or evidence before the reader answers.`,
      `Keep the complete coverage, choice, and comprehension fields in the machine-readable handoff; the materializer owns their Markdown tables and visible prompts.`,
      `In EVAL-FINDINGS use exactly these six tags and include every named field:`,
      `COVERAGE_D0 | status=...; implementation=...; evidence=...; tests=...`,
      `COVERAGE_R1 | status=...; implementation=...; evidence=...; tests=...`,
      `COVERAGE_R2 | status=...; implementation=...; evidence=...; tests=...`,
      `CHOICE | value=...; evidence=...; intentFit=...; impact=...`,
      `HUMAN_REVIEW | verdict=...; exception=...; action=...; noPerRowApproval=true`,
      `COMPREHENSION | questionCount=...; answersHidden=true; recallBeforeChoices=true; revisitCount=...; progressPersisted=false; prReadyBeforeQuiz=false`,
      CASE,
      TAIL_SPEC,
    ].join("\n");
  },
};
