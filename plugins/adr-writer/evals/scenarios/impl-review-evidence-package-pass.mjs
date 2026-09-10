import {
  agentText,
  skillText,
  seedRuleDocs,
  seedMapping,
  TAIL_SPEC,
  expectNoText,
  validateReviewArtifact,
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

- The Decision is supported by the guarded settlement flow and the two tests below.
- Obligation 1 is supported by an idempotency guard and a passing duplicate-settlement test.
- Obligation 2 is supported by provider failure injection and a passing test that leaves
  the payment pending.
- The ADR did not specify retry timing. The code chose a fixed 250 ms delay. This remains
  below ADR resolution, keeps retries bounded, preserves the failure result, and affects
  recovery latency and upstream request rate.
- There are no confirmed findings or unverified core risks.
`;
const PR_GUIDANCE =
  "Do not open or send the PR until every comprehension question is answered correctly without reading the answer criteria.";
const QUIZ_QUESTION = "Why does a provider failure leave the payment pending instead of completed?";
const QUIZ_ANSWER =
  "A successful provider result must cross the idempotent completion boundary before completion is recorded.";
const QUIZ_EVIDENCE = "ADR R2 and the provider failure test";

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

function taggedSummary(tail, tag) {
  return tail.findings.find((finding) => finding.tag === tag)?.summary ?? "";
}

function visibleOutput(output) {
  return output.split(/---\s*\n\s*## Machine-readable tail|===\s*EVAL-VERDICT/i)[0];
}

function usesOnlySuppliedPaths(output) {
  const paths = [
    ...output.matchAll(/\b(?:src|test|tests)\/[\w./-]+|[\w./-]+\.(?:ts|js|mjs):\d+/gi),
  ].map((match) => match[0]);
  return paths.every((value) =>
    [
      "src/payments/settle.ts",
      "test/payments/settle.test.ts",
      "settle.ts:42",
      "settle.ts:58",
    ].includes(value),
  );
}

function coverageRows(visible) {
  return visible.split("\n").filter((line) => line.includes("|") && /\b(?:D0|R1|R2)\b/.test(line));
}

function completeTableRow(row) {
  return Boolean(row && row.split("|").filter((cell) => cell.trim()).length >= 4);
}

export default {
  name: "impl-review-evidence-package-pass",
  description:
    "/adr-impl-review must return PASS without another architecture decision when every obligation is PROVEN, while still surfacing complete read-only coverage, ADR-intent fit, and a separate pre-PR comprehension check.",

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
      skillText("adr-impl-review"),
      agentText("adr-impl-review-report-writer", {
        references: [
          "references/review-report-writing.md",
          "references/reader-first-writing.md",
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
      `Context fields must be exactly: Payment settlement preserves one durable result. / Payment settlement receives retries and provider outcomes. / One completion boundary preserves idempotency and pending state. / Duplicate and provider-failure paths determine the verdict.`,
      `Hill H1 heading: A retry reaches the idempotent boundary.`,
      `Hill H1 vertical slice must be user-flow / Duplicate payment settlement.`,
      `Hill H1 Container must explain retry responsibility, interactions, and one-completion outcome. Component C1 must explain the idempotent boundary and include a focused diff Code evidence.`,
      `Hill H2 heading: Provider failure leaves the payment pending.`,
      `Hill H2 vertical slice must be user-flow / Provider failure settlement.`,
      `Hill H2 Container must explain provider-failure responsibility, interactions, and pending outcome. Component C1 must explain the failure branch and include a focused diff Code evidence.`,
      `Put <!-- generated container zoom from findings.json --> and <!-- generated component zoom from findings.json --> once after each Hill question.`,
      `Put <!-- generated hill evidence from findings.json --> once after each Hill Components block.`,
      `Inside H2 include V1 sequenceDiagram showing the provider request, successful response and failure branch with the pending outcome. A separate state diagram is not needed. Include %% requirement: V1 and a following Notice: sentence. Draw the supplied code path; do not claim an unexecuted path was verified.`,
      `Follow the verified payment retry or provider-failure flow where it helps. Do not default to implementation order.`,
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
      `HUMAN_REVIEW | verdict=...; decisionRequired=...; noPerRowApproval=true`,
      `COMPREHENSION | questionCount=...; answersHidden=true; recallBeforeChoices=true; revisitCount=...; progressPersisted=false; prReadyBeforeQuiz=false`,
      CASE,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail, output, dir }) {
    const visible = visibleOutput(output);
    const d0 = taggedSummary(tail, "COVERAGE_D0");
    const r1 = taggedSummary(tail, "COVERAGE_R1");
    const r2 = taggedSummary(tail, "COVERAGE_R2");
    const choice = taggedSummary(tail, "CHOICE");
    const humanReview = taggedSummary(tail, "HUMAN_REVIEW");
    const comprehension = taggedSummary(tail, "COMPREHENSION");
    const artifact = validateReviewArtifact(dir, visible, {
      language: "en",
      reviewMode: "full",
      adr: "docs/adr/payments/settlement/0001-idempotent-payment-settlement.md",
      status: "Accepted (2026-08-17)",
      verdict: "PASS",
      atAGlance: {
        impact: "Settlement behavior matches the recorded contract.",
        action: "None.",
        risk: "No unverified core risk remains.",
      },
      relatedAdrComparisons: [],
      relatedAdrComparisonOmissionReason:
        "No other fixture ADR shares the settlement boundary closely enough to aid comparison.",
      diagramRequirements: [
        ["sequenceDiagram", "How does the settlement request reach the provider?"],
      ].map(([diagramType, question], index) => ({
        id: `V${index + 1}`,
        diagramType,
        question,
        section: "Provider failure leaves the payment pending",
        reason: "The sequence explains the request order and failure outcome in one view.",
        evidence: "The scenario's settlement decision and supplied provider-failure code path.",
      })),
      reviewHike: {
        context: {
          intent: "Payment settlement preserves one durable result.",
          preconditions: "Payment settlement receives retries and provider outcomes.",
          contracts: "One completion boundary preserves idempotency and pending state.",
          scopeAndRisk: "Duplicate and provider-failure paths determine the verdict.",
        },
        hills: [
          {
            id: "H1",
            title: "A retry reaches the idempotent boundary",
            sliceType: "user-flow",
            sliceName: "Duplicate payment settlement",
            reviewQuestion: "Can a retry create more than one completion?",
            diagramIds: [],
            diagramOmissionReason:
              "This isolated duplicate guard returns one existing result, fully explained in two sentences.",
            claim: "A retry reuses one durable completion.",
            workedExample: "Two requests with one key produce one stored result.",
            counterexample: "A second completion for the same key violates idempotency.",
            assessment: "The duplicate-settlement test proves this path.",
            container: {
              responsibility: "Reuse one completion for a retry.",
              interactions: "The retry reaches the idempotency boundary and stored result.",
              outcome: "The payment remains completed once.",
            },
            components: [
              {
                id: "C1",
                name: "Idempotency boundary",
                responsibility: "Separate new settlement from retries.",
                implementation: "Return the existing completion for the same key.",
                verification: "The duplicate-settlement test observes one payment.",
                codeEvidence: [
                  {
                    kind: "diff",
                    location: "src/payments/settle.ts:42",
                    content: "- complete(payment)\n+ return existing ?? complete(payment)",
                    explanation: "The retry path reuses the existing completion.",
                    tests: "duplicate-settlement test — PASS",
                  },
                ],
              },
            ],
            contractIds: ["R1"],
          },
          {
            id: "H2",
            title: "Provider failure leaves the payment pending",
            sliceType: "user-flow",
            sliceName: "Provider failure settlement",
            reviewQuestion: "Can provider failure record completion?",
            diagramIds: ["V1"],
            claim: "Provider failure stays outside the completion boundary.",
            workedExample: "A failed provider call leaves the payment pending.",
            counterexample: "Recording completion after failure violates the contract.",
            assessment: "The provider-failure test proves the pending-state path.",
            container: {
              responsibility: "Keep provider failure outside completion.",
              interactions: "The provider failure returns to settlement.",
              outcome: "No completed payment is visible.",
            },
            components: [
              {
                id: "C1",
                name: "Provider failure branch",
                responsibility: "Preserve pending state until provider success.",
                implementation: "The failure path keeps the payment pending.",
                verification: "The provider-failure test observes no completion.",
                codeEvidence: [
                  {
                    kind: "diff",
                    location: "src/payments/settle.ts:58",
                    content: "- recordCompletion(payment)\n+ keepPending(payment)",
                    explanation: "Failure no longer records completion.",
                    tests: "provider-failure test — PASS",
                  },
                ],
              },
            ],
            contractIds: ["D0", "R2"],
          },
        ],
      },
      scope: ["src/payments/settle.ts", "test/payments/settle.test.ts"],
      changeScope: ["src/payments/settle.ts", "test/payments/settle.test.ts"],
      metrics: {
        startedAt: "2026-08-17T00:00:00.000Z",
        completedAt: "2026-08-17T00:00:02.000Z",
        elapsedSeconds: 2,
        necessityFindingCount: 0,
        sufficiencyFindingCount: 0,
        unverifiedRiskCount: 0,
        testCommandCount: 2,
      },
      implementationChoices: [
        {
          choice: "retry uses a 250 ms fixed delay",
          evidence: "review evidence: fixed 250 ms delay",
          intentFit: "keeps retries bounded and preserves the failure result",
          whyItMatters: "changes recovery latency and upstream request rate",
        },
      ],
      reviewDiagnostics: {
        contractCompleteness: {
          status: "CLEAR",
          assessment: "Every reviewed settlement behavior has a contract row.",
          evidence: "D0, R1, and R2 are each assigned once.",
        },
        testSufficiency: {
          status: "CLEAR",
          assessment: "Ideal and provider-failure tests pass.",
          evidence: "Both targeted settlement tests passed.",
        },
        necessity: {
          status: "CLEAR",
          assessment: "No removable settlement change was found.",
          evidence: "The necessity perspective found no excess scope.",
        },
      },
      comprehensionCheck: {
        prGuidance: PR_GUIDANCE,
        questions: [
          {
            id: "Q1",
            question: QUIZ_QUESTION,
            options: [
              {
                id: "A",
                text: "Record completion immediately",
                feedback: "Provider success is still missing.",
              },
              { id: "B", text: "Keep the payment pending", feedback: QUIZ_ANSWER },
              {
                id: "C",
                text: "Delete the payment",
                feedback: "Deletion is not the failure contract.",
              },
              {
                id: "D",
                text: "Ignore the provider result",
                feedback: "The provider result gates completion.",
              },
            ],
            revisit: true,
            correctOptionId: "B",
            explanation: QUIZ_ANSWER,
            evidence: QUIZ_EVIDENCE,
          },
        ],
      },
      contractCoverage: [
        {
          contractId: "D0",
          requirement: "Idempotent settlement and pending-on-failure decision",
          status: "PROVEN",
          adrBasis: "Decision",
          implementation: "guarded settlement flow preserves both outcomes",
          evidence: "guard and failure injection evidence",
          tests: "duplicate settlement and provider failure tests — PASS",
        },
        {
          contractId: "R1",
          requirement: "A payment is completed at most once",
          status: "PROVEN",
          adrBasis: "A payment is completed at most once.",
          implementation: "idempotency guard prevents duplicate completion",
          evidence: "repeated settlement leaves one completion",
          tests: "duplicate settlement test — PASS",
        },
        {
          contractId: "R2",
          requirement: "Provider failure never records payment completion",
          status: "PROVEN",
          adrBasis: "Provider failure never records payment completion.",
          implementation: "provider failure leaves payment pending",
          evidence: "failure injection preserves pending state",
          tests: "provider failure test — PASS",
        },
      ],
      findings: [],
    });
    const materializedVisible = artifact.report || visible;
    const [d0Row, r1Row, r2Row] = coverageRows(materializedVisible);

    return [
      {
        pass: tail.verdict === "PASS",
        detail: `verdict=${tail.verdict ?? "missing"}`,
        label: "returns PASS when every obligation is PROVEN",
      },
      {
        pass:
          /status\s*=\s*PROVEN/i.test(d0) &&
          /implementation\s*=\s*[^;]+/i.test(d0) &&
          /evidence\s*=\s*[^;]+/i.test(d0) &&
          /tests\s*=\s*[^;]*(?:PASS|통과)/i.test(d0) &&
          /status\s*=\s*PROVEN/i.test(r1) &&
          /implementation\s*=\s*[^;]+/i.test(r1) &&
          /evidence\s*=\s*[^;]+/i.test(r1) &&
          /tests\s*=\s*[^;]*(?:PASS|통과)/i.test(r1) &&
          /status\s*=\s*PROVEN/i.test(r2) &&
          /implementation\s*=\s*[^;]+/i.test(r2) &&
          /evidence\s*=\s*[^;]+/i.test(r2) &&
          /tests\s*=\s*[^;]*(?:PASS|통과)/i.test(r2),
        detail: `D0=${d0 || "missing"} ; R1=${r1 || "missing"} ; R2=${r2 || "missing"}`,
        label: "machine coverage records the Decision and both obligations as PROVEN",
      },
      {
        pass: completeTableRow(d0Row) && completeTableRow(r1Row) && completeTableRow(r2Row),
        detail: `D0=${d0Row ?? "missing"} ; R1=${r1Row ?? "missing"} ; R2=${r2Row ?? "missing"}`,
        label: "human-facing coverage gives every ADR-derived ID a complete table row",
      },
      {
        pass: artifact.pass,
        detail: artifact.detail,
        label: "generated report passes the shipped artifact validator and HTML renderer",
      },
      {
        pass:
          /250\s*ms/i.test(choice) &&
          /evidence\s*=\s*[^;]+/i.test(choice) &&
          /intentFit\s*=\s*[^;]*(?:bounded|failure|contract|ADR|보존|계약|실패)/i.test(choice) &&
          /impact\s*=\s*[^;]*(?:latency|request rate|지연|요청률)/i.test(choice),
        detail: choice || "missing CHOICE",
        label: "PASS package still explains material implementation discretion",
      },
      {
        pass:
          /verdict\s*=\s*PASS/i.test(humanReview) &&
          /decisionRequired\s*=\s*(?:false|none|no|없음|불필요)/i.test(humanReview) &&
          /noPerRowApproval\s*=\s*true/i.test(humanReview),
        detail: humanReview || "missing HUMAN_REVIEW",
        label: "PASS completes without another architecture decision or per-row approval",
      },
      {
        pass:
          /questionCount\s*=\s*[1-5]\b/i.test(comprehension) &&
          /answersHidden\s*=\s*true/i.test(comprehension) &&
          /recallBeforeChoices\s*=\s*true/i.test(comprehension) &&
          /revisitCount\s*=\s*[12]\b/i.test(comprehension) &&
          /progressPersisted\s*=\s*false/i.test(comprehension) &&
          /prReadyBeforeQuiz\s*=\s*false/i.test(comprehension) &&
          materializedVisible.includes("## Context") &&
          materializedVisible.indexOf("## Context") < materializedVisible.indexOf("## Findings") &&
          /^## (?!Context$|Visual map$|Findings$).+/m.test(
            materializedVisible.slice(
              materializedVisible.indexOf("## Context") + "## Context".length,
              materializedVisible.indexOf("## Findings"),
            ),
          ) &&
          materializedVisible.includes("## Comprehension check") &&
          materializedVisible.includes(PR_GUIDANCE) &&
          materializedVisible.includes(QUIZ_QUESTION),
        detail: comprehension || "missing COMPREHENSION",
        label: "keeps a predictable explanation and a separate pre-PR comprehension gate",
      },
      expectNoText(
        materializedVisible,
        /approve (?:each|this (?:coverage|choice))[^.\n?]*\?|각 (?:행|선택)[^.\n?]*승인(?:해\s*주세요|하시겠습니까|\?)/i,
        "does not ask the user to approve each coverage row or implementation choice",
      ),
      expectNoText(
        materializedVisible,
        /(?:the key is|what matters is|ultimately|firstly|secondly|thirdly).*(?:the key is|what matters is|ultimately|firstly|secondly|thirdly)/is,
        "does not use repeated filler bridges or forced numbered symmetry",
      ),
      {
        pass: usesOnlySuppliedPaths(materializedVisible),
        detail: "Code zoom contains only supplied implementation paths",
        label: "does not invent code or test paths absent from the supplied evidence",
      },
    ];
  },
};
