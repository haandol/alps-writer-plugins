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
const QUIZ_ANSWER =
  "The failure path was not executed, so the reviewer cannot verify that the payment remains pending.";
const QUIZ_EVIDENCE = "ADR R2 and the unavailable provider failure injection";

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

function coverageRow(visible, contractId) {
  return visible
    .split("\n")
    .find((line) => line.includes("|") && new RegExp(`\\b${contractId}\\b`, "i").test(line));
}

function completeTableRow(row) {
  return Boolean(row && row.split("|").filter((cell) => cell.trim()).length >= 4);
}

function orderedSections(visible) {
  const lines = visible.split("\n");
  const coverageRows = [
    lines.findIndex((line) => line.includes("|") && /\bD0\b/i.test(line)),
    lines.findIndex((line) => line.includes("|") && /\bR1\b/i.test(line)),
    lines.findIndex((line) => line.includes("|") && /\bR2\b/i.test(line)),
  ];
  const choiceRow = lines.findIndex((line) => line.includes("|") && /250\s*ms/i.test(line));
  const findingHeading = lines.findIndex((line) =>
    /^#{2,3}\s+(?:Findings|발견 사항|검토 결과|Residual risks|잔여 리스크|사람 판단)/i.test(line),
  );
  const lastCoverageRow = Math.max(...coverageRows);
  return (
    coverageRows.every((index) => index >= 0) &&
    findingHeading >= 0 &&
    findingHeading < Math.min(...coverageRows) &&
    choiceRow > lastCoverageRow &&
    choiceRow >= 0
  );
}

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
      skillText("adr-impl-review"),
      agentText("adr-impl-review-report-writer", {
        references: ["references/review-report-writing.md", "references/reader-first-writing.md"],
      }),
      `\n---\n\n# This run`,
      `Produce the concise human-facing Evidence Package for this completed review.`,
      `The normal response is the narrative source for implementation-review.md,`,
      `starting with "# ADR implementation review" and including every required core heading.`,
      `Under At a glance, ADR contract coverage, Notable implementation choices, and Comprehension check, write only <!-- generated from findings.json -->.`,
      `Do not put conversational prose before or instead of the report file contents.`,
      `Do not invent files or tests beyond the facts below. Show the normal response first.`,
      `The normal response must lead with At a glance (Verdict, Impact, Action, Risk),`,
      `then ADR intent, one or more subject-specific narrative sections ordered by importance, findings, contract coverage, notable implementation choices, residual risks, and Comprehension check.`,
      `Follow the verified settlement or trust-boundary flow where it helps. Do not default to implementation order.`,
      `Remove repeated contrast templates, ornamental one-off labels, forced numbered symmetry, filler bridges, and duplicate visuals. Do not invent a story.`,
      `Coverage and choices are read-only.`,
      `The visible Comprehension check must include 1-5 free-response questions and this exact guidance: ${PR_GUIDANCE}`,
      `Include this question exactly: ${QUIZ_QUESTION}`,
      `Do not reveal the answer criteria or evidence before the reader answers.`,
      `Keep the complete coverage, choice, and comprehension fields in the machine-readable handoff; the materializer owns their Markdown tables and visible prompts.`,
      `In EVAL-FINDINGS use exactly these six tags and include every named field:`,
      `COVERAGE_D0 | status=...; implementation=...; evidence=...; tests=...`,
      `COVERAGE_R1 | status=...; implementation=...; evidence=...; tests=...`,
      `COVERAGE_R2 | status=...; implementation=...; evidence=...; tests=...`,
      `CHOICE | value=...; evidence=...; intentFit=...; impact=...`,
      `HUMAN_REVIEW | verdict=...; exception=...; action=...; noPerRowApproval=true`,
      `COMPREHENSION | questionCount=...; answersHidden=true; prReadyBeforeQuiz=false`,
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
      verdict: "INCONCLUSIVE",
      atAGlance: {
        impact: "Provider failure behavior remains unverified.",
        action: "Verify provider failure injection or accept the documented risk.",
        risk: "A provider failure could record completion without executed evidence.",
      },
      visualization: {
        required: false,
        reason: "The supplied fixture explains two local settlement paths in two short sections.",
      },
      scope: ["src/payments/settle.ts", "test/payments/settle.test.ts"],
      changeScope: ["src/payments/settle.ts"],
      metrics: {
        startedAt: "2026-08-17T00:00:00.000Z",
        completedAt: "2026-08-17T00:00:02.000Z",
        elapsedSeconds: 2,
        necessityFindingCount: 0,
        sufficiencyFindingCount: 1,
        unverifiedRiskCount: 1,
        testCommandCount: 1,
      },
      implementationChoices: [
        {
          choice: "retry uses a 250 ms fixed delay",
          evidence: "review evidence: fixed 250 ms delay",
          intentFit: "keeps retries bounded and preserves the failure result",
          whyItMatters: "changes recovery latency and upstream request rate",
        },
      ],
      comprehensionCheck: {
        prGuidance: PR_GUIDANCE,
        questions: [
          {
            id: "Q1",
            question: QUIZ_QUESTION,
            answerCriteria: QUIZ_ANSWER,
            evidence: QUIZ_EVIDENCE,
          },
        ],
      },
      contractCoverage: [
        {
          contractId: "D0",
          requirement: "Idempotent settlement and pending-on-failure decision",
          status: "UNVERIFIED",
          adrBasis: "Decision",
          implementation: "idempotency is verified but provider failure is not",
          evidence: "duplicate settlement passed; failure injection unavailable",
          tests: "duplicate settlement — PASS; provider failure — NOT RUN",
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
          status: "UNVERIFIED",
          adrBasis: "Provider failure never records payment completion.",
          implementation: "failure path exists but was not executed",
          evidence: "provider failure injection unavailable",
          tests: "NOT RUN — provider failure injection unavailable",
        },
      ],
      findings: [
        {
          category: "Unverified risk",
          perspective: "sufficiency",
          summary: "provider failure behavior was not executed",
          whyItMatters:
            "A provider failure could be recorded as completion without executed evidence.",
          expectedBehavior: "Provider failure leaves the payment pending.",
          observedBehavior: "The failure path exists but could not be executed.",
          requestedChange: "Run provider failure injection and verify the pending result.",
          editTargets: "provider failure fixture and settlement failure-path test",
          completionCriteria: "The failure-injection test passes and shows no completion record.",
          confidence: "high",
          code: "provider failure path supplied by the scenario",
          evidence: "failure injection is unavailable",
          test: "provider failure injection",
          testResult: "NOT RUN — unavailable",
          contractIds: ["D0", "R2"],
        },
      ],
    });
    const materializedVisible = artifact.report || visible;
    const d0Row = coverageRow(materializedVisible, "D0");
    const r1Row = coverageRow(materializedVisible, "R1");
    const r2Row = coverageRow(materializedVisible, "R2");

    return [
      {
        pass: tail.verdict === "INCONCLUSIVE",
        detail: `verdict=${tail.verdict ?? "missing"}`,
        label: "returns INCONCLUSIVE when a core obligation is UNVERIFIED",
      },
      {
        pass:
          /status\s*=\s*UNVERIFIED/i.test(d0) &&
          /implementation\s*=\s*[^;]+/i.test(d0) &&
          /evidence\s*=\s*[^;]+/i.test(d0) &&
          /tests\s*=\s*[^;]*(?:NOT RUN|미실행|실행하지 못)/i.test(d0),
        detail: d0 || "missing COVERAGE_D0",
        label: "machine coverage marks the compound Decision UNVERIFIED",
      },
      {
        pass:
          /status\s*=\s*PROVEN/i.test(r1) &&
          /implementation\s*=\s*[^;]+/i.test(r1) &&
          /evidence\s*=\s*[^;]+/i.test(r1) &&
          /tests\s*=\s*[^;]*(?:PASS|통과)/i.test(r1),
        detail: r1 || "missing COVERAGE_R1",
        label: "machine coverage records R1 as PROVEN with implementation, evidence, and tests",
      },
      {
        pass:
          /status\s*=\s*UNVERIFIED/i.test(r2) &&
          /implementation\s*=\s*[^;]+/i.test(r2) &&
          /evidence\s*=\s*[^;]+/i.test(r2) &&
          /tests\s*=\s*[^;]*(?:NOT RUN|미실행|실행하지 못)/i.test(r2),
        detail: r2 || "missing COVERAGE_R2",
        label:
          "machine coverage records R2 as UNVERIFIED with implementation, evidence, and test limits",
      },
      {
        pass: completeTableRow(d0Row) && completeTableRow(r1Row) && completeTableRow(r2Row),
        detail: `D0=${d0Row ?? "missing"} ; R1=${r1Row ?? "missing"} ; R2=${r2Row ?? "missing"}`,
        label: "human-facing coverage gives every ADR-derived ID a complete table row",
      },
      {
        pass:
          /250\s*ms/i.test(choice) &&
          /evidence\s*=\s*[^;]+/i.test(choice) &&
          /intentFit\s*=\s*[^;]*(?:bounded|failure|contract|ADR|보존|계약|실패)/i.test(choice) &&
          /impact\s*=\s*[^;]*(?:latency|request rate|지연|요청률)/i.test(choice),
        detail: choice || "missing CHOICE",
        label: "material implementation discretion includes evidence, ADR-intent fit, and impact",
      },
      {
        pass:
          /verdict\s*=\s*INCONCLUSIVE/i.test(humanReview) &&
          /exception\s*=\s*[^;]*(?:UNVERIFIED|provider|프로바이더|failure|실패|미검증|의무\s*2|R2)/i.test(
            humanReview,
          ) &&
          /action\s*=\s*[^;]*(?:verify|inject|accept|검증|주입|수용)/i.test(humanReview) &&
          /noPerRowApproval\s*=\s*true/i.test(humanReview),
        detail: humanReview || "missing HUMAN_REVIEW",
        label: "human review focuses on the material verification exception, not every row",
      },
      {
        pass: orderedSections(materializedVisible),
        detail: "expected findings before coverage, then choices",
        label: "human-facing package leads with findings before detailed evidence",
      },
      {
        pass:
          /questionCount\s*=\s*[1-5]\b/i.test(comprehension) &&
          /answersHidden\s*=\s*true/i.test(comprehension) &&
          /prReadyBeforeQuiz\s*=\s*false/i.test(comprehension) &&
          materializedVisible.includes("## ADR intent") &&
          materializedVisible.indexOf("## ADR intent") <
            materializedVisible.indexOf("## Findings") &&
          /^## (?!ADR intent$|Visual map$|Findings$).+/m.test(
            materializedVisible.slice(
              materializedVisible.indexOf("## ADR intent") + "## ADR intent".length,
              materializedVisible.indexOf("## Findings"),
            ),
          ) &&
          materializedVisible.includes("## Comprehension check") &&
          materializedVisible.includes(PR_GUIDANCE) &&
          materializedVisible.includes(QUIZ_QUESTION),
        detail: comprehension || "missing COMPREHENSION",
        label: "keeps the explanation predictable and the PR comprehension gate separate",
      },
      {
        pass: artifact.pass,
        detail: artifact.detail,
        label: "generated report passes the shipped artifact validator and HTML renderer",
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
      expectNoText(
        materializedVisible,
        /\b(?:src|test|tests)\/[\w./-]+|[\w./-]+\.(?:ts|js|mjs):\d+/i,
        "does not invent code or test paths absent from the supplied evidence",
      ),
    ];
  },
};
