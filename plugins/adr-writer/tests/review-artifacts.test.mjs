import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VALIDATOR = path.join(HERE, "../scripts/adr-impl-review-validate.mjs");
const FULL_AT_A_GLANCE = {
  impact: "Settlement can create two records for one request.",
  action: "Fix the completion boundary before merge.",
  risk: "No residual risk beyond the confirmed duplicate-settlement finding.",
};
const STANDARD_AT_A_GLANCE = {
  impact: "Existing parser inputs and outputs remain unchanged.",
  action: "None.",
  risk: "The review used the standard sufficiency perspective because no protected surface changed.",
};
const PR_GUIDANCE =
  "Do not open or send the PR until every comprehension question is answered correctly without reading the answer criteria.";

function validExplanation() {
  return `# Implementation explanation

## Context
Settlement must turn a provider result into one durable completion record without charging twice. Settlement receives retries and provider outcomes, and the review covers the completion boundary and failure path.

## A duplicate request reaches the completion boundary
The boundary admits one successful result and returns the stored result for a retry.

## Provider failure leaves the payment pending
The handler records completion only after provider success, so failure never looks completed.
`;
}

function component({
  name,
  responsibility,
  implementation,
  verification,
  location,
  content,
  explanation,
  tests = "node --test test/stream.test.mjs — PASS",
  kind = "diff",
}) {
  return {
    id: "C1",
    name,
    responsibility,
    implementation,
    verification,
    codeEvidence: [{ kind, location, content, explanation, tests }],
  };
}

function validComprehensionCheck() {
  return {
    prGuidance: PR_GUIDANCE,
    questions: [
      {
        id: "Q1",
        question: "Why must settlement record completion only once?",
        options: [
          {
            id: "A",
            text: "Retries create a new record.",
            feedback: "This would violate idempotency.",
          },
          {
            id: "B",
            text: "One boundary reuses the durable result.",
            feedback: "This matches the contract.",
          },
          {
            id: "C",
            text: "The provider owns duplicate detection.",
            feedback: "The local boundary owns it.",
          },
          {
            id: "D",
            text: "Duplicate completion is harmless.",
            feedback: "It changes the durable result.",
          },
        ],
        correctOptionId: "B",
        explanation: "The idempotency boundary prevents duplicate completion records.",
        evidence: "ADR R1; src/stream.mjs:4; duplicate settlement test",
      },
    ],
  };
}

function validParserComprehensionCheck() {
  return {
    prGuidance: PR_GUIDANCE,
    questions: [
      {
        id: "Q1",
        question: "Why does the helper extraction preserve parser compatibility?",
        options: [
          {
            id: "A",
            text: "It changes the public output.",
            feedback: "That would break compatibility.",
          },
          { id: "B", text: "It removes validation.", feedback: "Validation remains required." },
          {
            id: "C",
            text: "Inputs, validation order, and output remain unchanged.",
            feedback: "This is the compatibility contract.",
          },
          { id: "D", text: "Callers must migrate.", feedback: "No caller migration is allowed." },
        ],
        correctOptionId: "C",
        explanation: "The accepted inputs, validation order, and output remain unchanged.",
        evidence: "ADR R1; src/parser.mjs; parser compatibility test",
      },
    ],
  };
}

function validReviewHike() {
  return {
    context: {
      intent: "Settlement creates one durable result without charging twice.",
      preconditions: "Settlement receives duplicate requests and provider outcomes.",
      contracts: "One completion boundary preserves idempotency and pending state.",
      scopeAndRisk: "Retry and provider-failure paths determine the verdict.",
    },
    hills: [
      {
        id: "H1",
        title: "A duplicate request cannot create a second settlement",
        sliceType: "user-flow",
        sliceName: "Duplicate settlement request",
        reviewQuestion: "Can a duplicate request create more than one durable settlement?",
        claim: "A duplicate request reuses one durable settlement.",
        workedExample: "Two requests with one key produce one stored result.",
        counterexample: "A second write for the same key violates the contract.",
        assessment: "The duplicate path is covered by code and an ideal-case test.",
        container: {
          responsibility: "Reuse one durable settlement for a duplicate request.",
          interactions: "The request reaches the completion boundary and stored result.",
          outcome: "The request has one durable settlement.",
        },
        components: [
          component({
            name: "Idempotent completion boundary",
            responsibility: "Separate new work from a duplicate request.",
            implementation: "The vertical settlement path returns the existing result.",
            verification: "The duplicate request test observes one durable settlement.",
            location: "src/stream.mjs:4",
            content: "- writeSettlement(result)\n+ return existing ?? writeSettlement(result)",
            explanation: "The duplicate path reuses the durable result.",
          }),
        ],
        contractIds: ["D0"],
      },
      {
        id: "H2",
        title: "Provider failure does not cross the completion boundary",
        sliceType: "user-flow",
        sliceName: "Provider failure settlement",
        reviewQuestion: "Can provider failure appear as a completed settlement?",
        claim: "Provider failure stays outside the completion boundary.",
        workedExample: "A failed provider call leaves the payment pending.",
        counterexample: "Marking failure as completed violates the state contract.",
        assessment: "The failing test shows this path still needs correction.",
        container: {
          responsibility: "Keep provider failure outside the completion boundary.",
          interactions: "The provider failure returns to the settlement handler.",
          outcome: "No completed settlement is visible.",
        },
        components: [
          component({
            name: "Provider failure branch",
            responsibility: "Preserve pending state until provider success.",
            implementation: "The vertical failure path keeps the payment pending.",
            verification: "The provider-failure test observes no completed settlement.",
            location: "src/stream.mjs:12",
            content: "- markCompleted(payment)\n+ keepPending(payment)",
            explanation: "Failure no longer records completion.",
            tests: "node --test test/stream.test.mjs — FAIL: expected pending",
          }),
        ],
        contractIds: ["R1"],
      },
    ],
  };
}

function validParserReviewHike() {
  return {
    context: {
      intent: "Preserve parser compatibility while extracting a helper.",
      preconditions: "Existing callers depend on accepted inputs and outputs.",
      contracts: "Validation order and public output stay unchanged.",
      scopeAndRisk: "The parser and compatibility tests are in scope.",
    },
    hills: [
      {
        id: "H1",
        title: "Existing callers see the same parser behavior",
        sliceType: "logical-capability",
        sliceName: "Parser compatibility",
        reviewQuestion: "Does helper extraction preserve parser compatibility?",
        claim: "Helper extraction preserves caller-visible parser behavior.",
        workedExample: "A supported input returns the same public output.",
        counterexample: "Changing validation order or output would break callers.",
        assessment: "Compatibility tests cover the ideal and relevant edge paths.",
        container: {
          responsibility: "Preserve existing parser behavior.",
          interactions: "A caller submits supported input and receives public output.",
          outcome: "Existing callers observe no behavior change.",
        },
        components: [
          component({
            name: "Parser helper",
            responsibility: "Validate and transform supported input.",
            implementation: "The helper performs the same validation and transformation.",
            verification: "Compatibility tests observe no caller-visible behavior change.",
            location: "src/parser.mjs:1",
            content: "- parseInline(input)\n+ parseWithHelper(input)",
            explanation: "The extracted helper preserves parser behavior.",
            tests: "node --test test/parser.test.mjs — PASS",
          }),
        ],
        contractIds: ["D0", "R1"],
      },
    ],
  };
}

function actionFields(overrides = {}) {
  return {
    whyItMatters: "Duplicate completion creates an incorrect durable result.",
    expectedBehavior: "One request creates at most one completion record.",
    observedBehavior: "The current path can write two completion records.",
    requestedChange: "Make the completion boundary reject or reuse duplicate work.",
    editTargets: "src/stream.mjs — completion boundary",
    completionCriteria: "The duplicate-settlement test passes with exactly one record.",
    ...overrides,
  };
}

function withArtifacts(run) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "adr-review-artifacts-"));
  try {
    mkdirSync(dir, { recursive: true });
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function validate(dir) {
  return spawnSync(process.execPath, [VALIDATOR, dir], { encoding: "utf8" });
}

function writeAdr(dir, requirement = "Settlement completes at most once") {
  const adr = path.join(dir, "docs/adr/streaming/0001.md");
  mkdirSync(path.dirname(adr), { recursive: true });
  writeFileSync(
    adr,
    `# ADR 0001: settlement

## Decision

Settlement uses an idempotent completion boundary.

### Requirement contract

- ${requirement}

### Alternatives

1. one
2. two

## Consequences

Current state.
`,
  );
  return adr;
}

function validReport() {
  return `# ADR implementation review

## At a glance
- Verdict: FIX_REQUIRED
- Impact: ${FULL_AT_A_GLANCE.impact}
- Action: ${FULL_AT_A_GLANCE.action}
- Risk: ${FULL_AT_A_GLANCE.risk}

## Review mode
full

## Scope
stream settlement

## Context
<!-- generated review context start -->

### Intent

Settlement creates one durable result without charging twice.

### Preconditions and surrounding context

Settlement receives duplicate requests and provider outcomes.

### Core contracts

One completion boundary preserves idempotency and pending state.

### Review scope and risk

Retry and provider-failure paths determine the verdict.

<!-- generated review context end -->

## A duplicate request cannot create a second settlement
Can a duplicate request create more than one durable settlement?

A duplicate request reuses one durable settlement.
Two requests with one key produce one stored result.
A second write for the same key violates the contract.
The duplicate path is covered by code and an ideal-case test.

<!-- generated container zoom start -->

- Vertical slice: Duplicate settlement request (user-flow)

### Responsibility

Reuse one durable settlement for a duplicate request.

### Interactions

The request reaches the completion boundary and stored result.

### Observable outcome

The request has one durable settlement.

<!-- generated container zoom end -->

<!-- generated component zoom start -->

### Component C1 · Idempotent completion boundary

- Responsibility: Separate new work from a duplicate request.
- Detailed implementation: The vertical settlement path returns the existing result.
- Verification result: The duplicate request test observes one durable settlement.

#### Code 1 · diff · src/stream.mjs:4

\`\`\`diff
- writeSettlement(result)
+ return existing ?? writeSettlement(result)
\`\`\`

- Why this code matters: The duplicate path reuses the durable result.
- Tests: node --test test/stream.test.mjs — PASS

<!-- generated component zoom end -->

<!-- generated hill evidence start -->

### D0 · Met · Idempotent settlement boundary

- Implementation: settlement has a single completion boundary
- Evidence: src/stream.mjs:4 — completion boundary
- Tests: node --test test/stream.test.mjs — PASS

<!-- generated hill evidence end -->

## Provider failure does not cross the completion boundary
Can provider failure appear as a completed settlement?

Provider failure stays outside the completion boundary.
A failed provider call leaves the payment pending.
Marking failure as completed violates the state contract.
The failing test shows this path still needs correction.

<!-- generated container zoom start -->

- Vertical slice: Provider failure settlement (user-flow)

### Responsibility

Keep provider failure outside the completion boundary.

### Interactions

The provider failure returns to the settlement handler.

### Observable outcome

No completed settlement is visible.

<!-- generated container zoom end -->

<!-- generated component zoom start -->

### Component C1 · Provider failure branch

- Responsibility: Preserve pending state until provider success.
- Detailed implementation: The vertical failure path keeps the payment pending.
- Verification result: The provider-failure test observes no completed settlement.

#### Code 1 · diff · src/stream.mjs:12

\`\`\`diff
- markCompleted(payment)
+ keepPending(payment)
\`\`\`

- Why this code matters: Failure no longer records completion.
- Tests: node --test test/stream.test.mjs — FAIL: expected pending

<!-- generated component zoom end -->

<!-- generated hill evidence start -->

### R1 · Fix required · Settlement completes at most once

- Implementation: the current settlement path can write twice
- Evidence: src/stream.mjs:12 — duplicate writes reproduced
- Tests: node --test test/stream.test.mjs — FAIL: expected 1, got 2

<!-- generated hill evidence end -->

## Findings
<!-- generated review diagnostics start -->

### Missing contracts

**Status.** CLEAR

Every reviewed behavior has a contract row.

**Evidence.** D0 and R1 are assigned once.

### Test gaps

**Status.** ISSUE

The provider-failure test currently fails.

**Evidence.** node --test test/stream.test.mjs

### Excess scope

**Status.** CLEAR

No removable change was found.

**Evidence.** Necessity review found no excess path.

<!-- generated review diagnostics end -->

### F1. Duplicate settlement
- Files and symbols to change: src/stream.mjs
- Scope not to touch: protocol
- Completion criteria: one record
- Needs confirmation: none

## ADR contract coverage
| Contract | Status | Hill | Requirement |
| --- | --- | --- | --- |
| D0 | Met | H1 | Idempotent settlement boundary |
| R1 | Fix required | H2 | Settlement completes at most once |

## Notable implementation choices
| Selected value or behavior | Code evidence | Why it fits the ADR intent | Why it matters |
| --- | --- | --- | --- |
| 250 ms fixed retry | src/stream.mjs:8 | Preserves bounded recovery | Affects recovery latency |

## Tests
node --test test/stream.test.mjs — FAIL

## Residual risks
None beyond F1.

## Comprehension check
${PR_GUIDANCE}

1. Q1 — Why must settlement record completion only once?
   - A. Retries create a new record.
   - B. One boundary reuses the durable result.
   - C. The provider owns duplicate detection.
   - D. Duplicate completion is harmless.

## Repair guide
Fix F1 before merge.
`;
}

function validReportWithInlineCodeCells() {
  return validReport()
    .replace(
      "| D0 | Met | H1 | Idempotent settlement boundary |",
      "| `D0` | `Met` | H1 | Idempotent settlement boundary |",
    )
    .replace(
      "| R1 | Fix required | H2 | Settlement completes at most once |",
      "| `R1` | `Fix required` | H2 | Settlement completes at most once |",
    );
}

function validFindings(dir) {
  const adr = writeAdr(dir);
  return {
    language: "en",
    reviewMode: "full",
    adr,
    verdict: "FIX_REQUIRED",
    atAGlance: { ...FULL_AT_A_GLANCE },
    reviewHike: validReviewHike(),
    explanation: path.join(dir, "explanation.md"),
    report: path.join(dir, "implementation-review.md"),
    scope: ["src/stream.mjs", "test/stream.test.mjs"],
    changeScope: ["src/stream.mjs"],
    metrics: {
      startedAt: "2026-08-15T06:30:00.000Z",
      completedAt: "2026-08-15T06:35:42.000Z",
      elapsedSeconds: 342,
      necessityFindingCount: 0,
      sufficiencyFindingCount: 1,
      unverifiedRiskCount: 0,
      testCommandCount: 1,
    },
    implementationChoices: [
      {
        choice: "retry uses a 250 ms fixed delay",
        evidence: "src/stream.mjs:8 — retryDelayMs: 250",
        intentFit: "preserves the ADR's bounded recovery and failure guarantees",
        whyItMatters: "changes recovery latency and request rate",
      },
    ],
    reviewDiagnostics: {
      contractCompleteness: {
        status: "CLEAR",
        assessment: "Every reviewed behavior has a contract row.",
        evidence: "D0 and R1 are assigned once.",
      },
      testSufficiency: {
        status: "ISSUE",
        assessment: "The provider-failure test currently fails.",
        evidence: "node --test test/stream.test.mjs",
      },
      necessity: {
        status: "CLEAR",
        assessment: "No removable change was found.",
        evidence: "Necessity review found no excess path.",
      },
    },
    comprehensionCheck: validComprehensionCheck(),
    contractCoverage: [
      {
        contractId: "D0",
        requirement: "Idempotent settlement boundary",
        status: "PROVEN",
        adrBasis: "Decision",
        implementation: "settlement has a single completion boundary",
        evidence: "src/stream.mjs:4 — completion boundary",
        tests: "node --test test/stream.test.mjs — PASS",
      },
      {
        contractId: "R1",
        requirement: "Settlement completes at most once",
        status: "VIOLATED",
        adrBasis: "Settlement completes at most once",
        implementation: "the current settlement path can write twice",
        evidence: "src/stream.mjs:12 — duplicate writes reproduced",
        tests: "node --test test/stream.test.mjs — FAIL: expected 1, got 2",
      },
    ],
    findings: [
      {
        ...actionFields(),
        category: "Spec violation",
        perspective: "sufficiency",
        summary: "settlement can run twice",
        confidence: "high",
        code: "src/stream.mjs:12",
        evidence: "deterministic race reproduced two records",
        test: "node --test test/stream.test.mjs",
        testResult: "FAIL: expected 1, got 2",
        contractIds: ["R1"],
      },
    ],
  };
}

function validStandardReport() {
  return `# ADR implementation review

## At a glance
- Verdict: PASS
- Impact: ${STANDARD_AT_A_GLANCE.impact}
- Action: ${STANDARD_AT_A_GLANCE.action}
- Risk: ${STANDARD_AT_A_GLANCE.risk}

## Review mode
standard — localized implementation reinforcement

## Scope
src/parser.mjs

## Context
Preserve parser compatibility while extracting a helper.
Existing callers depend on accepted inputs and outputs.
Validation order and public output stay unchanged.
The parser and compatibility tests are in scope.

## Existing callers see the same parser behavior
Does helper extraction preserve parser compatibility?

Helper extraction preserves caller-visible parser behavior.
A supported input returns the same public output.
Changing validation order or output would break callers.
Compatibility tests cover the ideal and relevant edge paths.

Parser compatibility
Preserve existing parser behavior.
A caller submits supported input and receives public output.
Existing callers observe no behavior change.

### Component C1 · Parser helper

Validate and transform supported input.
The helper performs the same validation and transformation.
Compatibility tests observe no caller-visible behavior change.

#### Code 1 · diff · src/parser.mjs:1

\`\`\`diff
- parseInline(input)
+ parseWithHelper(input)
\`\`\`

The extracted helper preserves parser behavior.
node --test test/parser.test.mjs — PASS

The helper extraction changes organization without changing validation or output.

<!-- generated hill evidence start -->

### D0 · Met · Parser compatibility

- Implementation: the parser preserves accepted inputs and outputs
- Evidence: src/parser.mjs — behavior-preserving helper extraction
- Tests: node --test test/parser.test.mjs — PASS

### R1 · Met · Existing parsing behavior remains unchanged

- Implementation: the parser preserves accepted inputs and outputs
- Evidence: src/parser.mjs — behavior-preserving helper extraction
- Tests: node --test test/parser.test.mjs — PASS

<!-- generated hill evidence end -->

## Findings
<!-- generated review diagnostics start -->

### Missing contracts

**Status.** CLEAR

Every parser behavior has a contract row.

**Evidence.** D0 and R1 are assigned once.

### Test gaps

**Status.** CLEAR

Ideal and compatibility edge tests pass.

**Evidence.** node --test test/parser.test.mjs — PASS

### Excess scope

**Status.** CLEAR

The extraction changes organization only.

**Evidence.** Necessity review found no removable behavior.

<!-- generated review diagnostics end -->

None

## ADR contract coverage
| Contract | Status | Hill | Requirement |
| --- | --- | --- | --- |
| D0 | Met | H1 | Parser compatibility |
| R1 | Met | H1 | Existing parsing behavior remains unchanged |

## Notable implementation choices
None found.

## Tests
node --test test/parser.test.mjs — PASS

## Residual risks
Standard sufficiency perspective only; no protected surface changed.

## Comprehension check
${PR_GUIDANCE}

1. Q1 — Why does the helper extraction preserve parser compatibility?
   - A. It changes the public output.
   - B. It removes validation.
   - C. Inputs, validation order, and output remain unchanged.
   - D. Callers must migrate.
`;
}

test("review artifact validator accepts a concise full report with required Mermaid", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    writeFileSync(path.join(dir, "implementation-review.md"), validReport());
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(validFindings(dir), null, 2));

    const result = validate(dir);
    assert.equal(result.status, 0, result.stderr);
  });
});

test("review artifact validator accepts inline-code contract IDs and statuses", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    writeFileSync(path.join(dir, "implementation-review.md"), validReportWithInlineCodeCells());
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(validFindings(dir), null, 2));

    const result = validate(dir);
    assert.equal(result.status, 0, result.stderr);
  });
});

test("review artifact validator requires each contract in exactly one Hill", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    writeFileSync(path.join(dir, "implementation-review.md"), validReport());
    const findings = validFindings(dir);
    findings.reviewHike.hills[0].contractIds.push("R1");
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /assigned to more than one Hill: R1/);
  });
});

test("review artifact validator rejects unknown and unassigned Hill contracts", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    writeFileSync(path.join(dir, "implementation-review.md"), validReport());
    const findings = validFindings(dir);
    findings.reviewHike.hills[1].contractIds = ["R99"];
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /references unknown contract row: R99/);
    assert.match(result.stderr, /not assigned to a Review Hiking Hill: R1/);
  });
});

test("review artifact validator requires Context, Container, Component, and Code evidence", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    writeFileSync(path.join(dir, "implementation-review.md"), validReport());
    const findings = validFindings(dir);
    delete findings.reviewHike.context.scopeAndRisk;
    findings.reviewHike.hills[0].sliceType = "backend";
    delete findings.reviewHike.hills[0].sliceName;
    delete findings.reviewHike.hills[1].container.interactions;
    delete findings.reviewHike.hills[1].components[0].verification;
    findings.reviewHike.hills[1].components[0].codeEvidence[0].kind = "patch";
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /reviewHike\.context\.scopeAndRisk must be a non-empty string/);
    assert.match(
      result.stderr,
      /reviewHike\.hills\[0\]\.sliceType must be user-flow, logical-capability, or bounded-context/,
    );
    assert.match(result.stderr, /reviewHike\.hills\[0\]\.sliceName must be a non-empty string/);
    assert.match(
      result.stderr,
      /reviewHike\.hills\[1\]\.container\.interactions must be a non-empty string/,
    );
    assert.match(
      result.stderr,
      /reviewHike\.hills\[1\]\.components\[0\]\.verification must be a non-empty string/,
    );
    assert.match(
      result.stderr,
      /reviewHike\.hills\[1\]\.components\[0\]\.codeEvidence\[0\]\.kind must be diff or excerpt/,
    );
  });
});

test("review artifact validator requires a diff for changed scope and permits excerpts without change scope", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    writeFileSync(
      path.join(dir, "implementation-review.md"),
      validReport().replaceAll("· diff ·", "· excerpt ·"),
    );
    const findings = validFindings(dir);
    for (const hill of findings.reviewHike.hills) {
      for (const item of hill.components[0].codeEvidence) item.kind = "excerpt";
    }
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const changedResult = validate(dir);
    assert.equal(changedResult.status, 1);
    assert.match(changedResult.stderr, /at least one diff Code evidence/);

    findings.changeScope = [];
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));
    const existingResult = validate(dir);
    assert.equal(existingResult.status, 0, existingResult.stderr);
  });
});

test("review artifact validator rejects missing core headings and evidence fields", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    writeFileSync(path.join(dir, "implementation-review.md"), "# short report\n");
    const findings = validFindings(dir);
    findings.visualization = {
      required: false,
      reason: "This fixture isolates missing headings and evidence fields.",
    };
    delete findings.findings[0].evidence;
    delete findings.findings[0].whyItMatters;
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /evidence must be a non-empty string/);
    assert.doesNotMatch(result.stderr, /whyItMatters must be a non-empty string/);
    assert.match(result.stderr, /missing: ## ADR contract coverage/);
    assert.doesNotMatch(result.stderr, /Mermaid fence|declared flowchart/);
  });
});

test("review artifact validator accepts the zoom hierarchy without a global Trail map", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    writeFileSync(path.join(dir, "implementation-review.md"), validReport());
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(validFindings(dir), null, 2));

    const result = validate(dir);
    assert.equal(result.status, 0, result.stderr);
  });
});

test("review artifact validator accepts artifacts without visualization metadata", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    writeFileSync(path.join(dir, "implementation-review.md"), validReport());
    const findings = validFindings(dir);
    delete findings.visualization;
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 0, result.stderr);
  });
});

test("review artifact validator accepts an additional Mermaid inside a Hill", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    writeFileSync(
      path.join(dir, "implementation-review.md"),
      validReport().replace(
        "The handler records completion only after provider success.",
        `The handler records completion only after provider success.

\`\`\`mermaid
stateDiagram-v2
  pending --> completed: provider success
  pending --> pending: provider failure
\`\`\`
Notice: The Hill diagram keeps provider failure outside the completed state.`,
      ),
    );
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(validFindings(dir), null, 2));

    const result = validate(dir);
    assert.equal(result.status, 0, result.stderr);
  });
});

test("review artifact validator accepts multiple Mermaid diagrams inside Hills", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    writeFileSync(
      path.join(dir, "implementation-review.md"),
      validReport().replace(
        "The completion boundary admits one result and rejects or reuses duplicate work.",
        `The completion boundary admits one result and rejects or reuses duplicate work.

\`\`\`mermaid
sequenceDiagram
  participant API
  participant Provider
  API->>Provider: settlement request
  Provider-->>API: result
\`\`\`
Notice: The second diagram explains request order separately from the completion branch.
`,
      ),
    );
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(validFindings(dir), null, 2));

    const result = validate(dir);
    assert.equal(result.status, 0, result.stderr);
  });
});

test("review artifact validator requires internally consistent review metrics", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    writeFileSync(path.join(dir, "implementation-review.md"), validReport());
    const findings = validFindings(dir);
    findings.metrics.unverifiedRiskCount = 1;
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unverifiedRiskCount is 1, expected 0/);
  });
});

test("review artifact validator requires report language and valid finding contract links", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    writeFileSync(path.join(dir, "implementation-review.md"), validReport());
    const findings = validFindings(dir);
    delete findings.language;
    findings.findings[0].contractIds = ["R99"];
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /language must be a non-empty string/);
    assert.match(result.stderr, /references unknown contract row: R99/);
  });
});

test("review artifact validator rejects incomplete notable implementation choices", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    writeFileSync(path.join(dir, "implementation-review.md"), validReport());
    const findings = validFindings(dir);
    delete findings.implementationChoices[0].intentFit;
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /implementationChoices\[0\]\.intentFit must be a non-empty string/);
  });
});

test("review artifact validator requires a complete At a glance handoff", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    writeFileSync(
      path.join(dir, "implementation-review.md"),
      validReport().replace(`- Risk: ${FULL_AT_A_GLANCE.risk}\n`, ""),
    );
    const findings = validFindings(dir);
    delete findings.atAGlance.risk;
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /atAGlance\.risk must be a non-empty string/);
  });
});

test("review artifact validator requires separate implementation and change scopes", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    writeFileSync(path.join(dir, "implementation-review.md"), validReport());
    const findings = validFindings(dir);
    delete findings.changeScope;
    findings.scope = [];
    findings.verdict = "PASS";
    findings.findings = [];
    findings.metrics.sufficiencyFindingCount = 0;
    findings.contractCoverage = findings.contractCoverage.map((row) => ({
      ...row,
      status: "PROVEN",
      tests: "node --test test/stream.test.mjs — PASS",
    }));
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /changeScope must be an array/);
    assert.match(result.stderr, /PASS requires a non-empty complete implementation scope/);
  });
});

test("review artifact validator rejects missing coverage fields and non-proven PASS rows", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    writeFileSync(path.join(dir, "implementation-review.md"), validStandardReport());
    const findings = validFindings(dir);
    findings.reviewMode = "standard";
    findings.reviewHike = validParserReviewHike();
    findings.verdict = "PASS";
    findings.atAGlance = { ...STANDARD_AT_A_GLANCE };
    findings.comprehensionCheck = validParserComprehensionCheck();
    findings.findings = [];
    findings.implementationChoices = [];
    findings.metrics.sufficiencyFindingCount = 0;
    findings.contractCoverage[1].status = "UNVERIFIED";
    delete findings.contractCoverage[1].evidence;
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /contractCoverage\[1\]\.evidence must be a non-empty string/);
    assert.match(result.stderr, /PASS requires every contractCoverage row to be PROVEN/);
  });
});

test("review artifact validator accepts concise standard-mode artifacts without Mermaid", () => {
  withArtifacts((dir) => {
    writeAdr(dir, "Existing parsing behavior remains unchanged");
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    writeFileSync(path.join(dir, "implementation-review.md"), validStandardReport());
    const findings = validFindings(dir);
    writeAdr(dir, "Existing parsing behavior remains unchanged");
    findings.reviewMode = "standard";
    findings.reviewHike = validParserReviewHike();
    findings.verdict = "PASS";
    findings.atAGlance = { ...STANDARD_AT_A_GLANCE };
    findings.visualization = {
      required: false,
      reason: "The one-file parser refactor is clear in two sentences.",
    };
    findings.comprehensionCheck = validParserComprehensionCheck();
    findings.findings = [];
    findings.implementationChoices = [];
    findings.contractCoverage = [
      {
        contractId: "D0",
        requirement: "Parser compatibility",
        status: "PROVEN",
        adrBasis: "Decision",
        implementation: "the parser uses the same accepted inputs and outputs",
        evidence: "src/parser.mjs — behavior-preserving helper extraction",
        tests: "node --test test/parser.test.mjs — PASS",
      },
      {
        contractId: "R1",
        requirement: "Existing parsing behavior remains unchanged",
        status: "PROVEN",
        adrBasis: "Existing parsing behavior remains unchanged",
        implementation: "the parser uses the same accepted inputs and outputs",
        evidence: "src/parser.mjs — behavior-preserving helper extraction",
        tests: "node --test test/parser.test.mjs — PASS",
      },
    ];
    findings.metrics.sufficiencyFindingCount = 0;
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 0, result.stderr);
  });
});

test("review artifact validator accepts PASS without metrics, comprehension, or explanation artifacts", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    writeFileSync(
      path.join(dir, "implementation-review.md"),
      validStandardReport().replace(/## Comprehension check[\s\S]*$/, ""),
    );
    const findings = validFindings(dir);
    writeAdr(dir, "Existing parsing behavior remains unchanged");
    findings.reviewMode = "standard";
    findings.reviewHike = validParserReviewHike();
    findings.verdict = "PASS";
    findings.atAGlance = { ...STANDARD_AT_A_GLANCE };
    findings.visualization = {
      required: false,
      reason: "The one-file parser refactor is clear in two sentences.",
    };
    delete findings.metrics;
    delete findings.comprehensionCheck;
    delete findings.explanation;
    findings.findings = [];
    findings.implementationChoices = [];
    findings.contractCoverage = [
      {
        contractId: "D0",
        requirement: "Parser compatibility",
        status: "PROVEN",
        adrBasis: "Decision",
        implementation: "the parser preserves accepted inputs and outputs",
        evidence: "src/parser.mjs",
        tests: "node --test test/parser.test.mjs — PASS",
      },
      {
        contractId: "R1",
        requirement: "Existing parsing behavior remains unchanged",
        status: "PROVEN",
        adrBasis: "Existing parsing behavior remains unchanged",
        implementation: "the parser preserves accepted inputs and outputs",
        evidence: "src/parser.mjs",
        tests: "node --test test/parser.test.mjs — PASS",
      },
    ];
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 0, result.stderr);
  });
});

test("standard-mode artifacts reject necessity findings and missing contract coverage", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    writeFileSync(path.join(dir, "implementation-review.md"), "# ADR implementation review\n");
    const findings = validFindings(dir);
    findings.reviewMode = "standard";
    findings.reviewHike = validParserReviewHike();
    findings.atAGlance = { ...STANDARD_AT_A_GLANCE };
    findings.comprehensionCheck = validParserComprehensionCheck();
    findings.metrics.necessityFindingCount = 1;
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /necessityFindingCount must be 0/);
    assert.match(result.stderr, /missing: ## ADR contract coverage/);
  });
});

test("PASS rejects omitted ADR rows, duplicate IDs, unexecuted tests, and blocking findings", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    writeFileSync(path.join(dir, "implementation-review.md"), validStandardReport());
    const findings = validFindings(dir);
    writeAdr(dir, "Existing parsing behavior remains unchanged");
    findings.reviewMode = "standard";
    findings.reviewHike = validParserReviewHike();
    findings.verdict = "PASS";
    findings.atAGlance = { ...STANDARD_AT_A_GLANCE };
    findings.comprehensionCheck = validParserComprehensionCheck();
    findings.contractCoverage = [
      {
        contractId: "D0",
        requirement: "Parser compatibility",
        status: "PROVEN",
        adrBasis: "Decision",
        implementation: "claimed compatible",
        evidence: "static inspection only",
        tests: "NOT RUN",
      },
      {
        contractId: "D0",
        requirement: "Duplicate decision row",
        status: "PROVEN",
        adrBasis: "Decision",
        implementation: "claimed compatible",
        evidence: "duplicate",
        tests: "NOT RUN",
      },
    ];
    findings.metrics.testCommandCount = 0;
    findings.metrics.sufficiencyFindingCount = 1;
    findings.findings = [
      {
        ...actionFields({
          whyItMatters: "Parser compatibility is not protected by executable evidence.",
          expectedBehavior: "Accepted parser inputs and outputs remain unchanged.",
          observedBehavior: "The parser path has not been executed.",
          requestedChange: "Add and run the parser compatibility test.",
          editTargets: "test/parser.test.mjs",
          completionCriteria: "The compatibility test detects a behavior change and passes.",
        }),
        category: "Test gap",
        perspective: "sufficiency",
        summary: "parser behavior was not executed",
        confidence: "high",
        code: "src/parser.mjs",
        evidence: "no executed parser test",
        test: "node --test test/parser.test.mjs",
        testResult: "NOT RUN",
        contractIds: ["R1"],
      },
    ];
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /duplicate contractId: D0/);
    assert.match(result.stderr, /missing ADR contract row: R1/);
    assert.match(result.stderr, /tests must not contain failed or unexecuted results/);
    assert.match(result.stderr, /at least one executed test/);
    assert.match(result.stderr, /unresolved blocking findings: 1/);
  });
});

test("human-facing report requires complete coverage and implementation-choice summaries", () => {
  withArtifacts((dir) => {
    writeFileSync(
      path.join(dir, "implementation-review.md"),
      validReport()
        .replace(
          "| R1 | Fix required | H2 | Settlement completes at most once |",
          "| R1 | Fix required |",
        )
        .replace(
          "| 250 ms fixed retry | src/stream.mjs:8 | Preserves bounded recovery | Affects recovery latency |",
          "| 250 ms fixed retry | src/stream.mjs:8 |",
        ),
    );
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(validFindings(dir), null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /must have four non-empty summary columns/);
    assert.match(result.stderr, /must have four non-empty columns/);
  });
});

test("review artifact validator enforces an intent-first subject-specific explanation", () => {
  withArtifacts((dir) => {
    writeFileSync(
      path.join(dir, "explanation.md"),
      validExplanation().replace("## Context", "## Background"),
    );
    writeFileSync(path.join(dir, "implementation-review.md"), validReport());
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(validFindings(dir), null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /must start with ## Context/);
  });

  withArtifacts((dir) => {
    writeFileSync(
      path.join(dir, "explanation.md"),
      "# Implementation explanation\n\n## Context\nIntent only.\n",
    );
    writeFileSync(path.join(dir, "implementation-review.md"), validReport());
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(validFindings(dir), null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /subject-specific Hill after ## Context/);
  });
});

test("review artifact validator requires one to five hidden-answer comprehension questions", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    const findings = validFindings(dir);
    findings.comprehensionCheck.questions = Array.from({ length: 6 }, (_, index) => ({
      id: `Q${index + 1}`,
      question: `Question ${index + 1}?`,
      options: ["A", "B", "C", "D"].map((id) => ({
        id,
        text: `${id} option ${index + 1}`,
        feedback: `${id} feedback ${index + 1}`,
      })),
      correctOptionId: "A",
      explanation: `Answer ${index + 1}`,
      evidence: `Evidence ${index + 1}`,
    }));
    writeFileSync(
      path.join(dir, "implementation-review.md"),
      validReport().replace(
        "1. Q1 — Why must settlement record completion only once?",
        `1. Q1 — Why must settlement record completion only once?\n\n${findings.comprehensionCheck.questions
          .slice(1)
          .map((question, index) => `${index + 2}. ${question.id} — ${question.question}`)
          .join("\n")}`,
      ),
    );
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /must contain 1 to 5 questions/);
  });

  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    const findings = validFindings(dir);
    writeFileSync(
      path.join(dir, "implementation-review.md"),
      validReport().replace(
        "1. Q1 — Why must settlement record completion only once?",
        `1. Q1 — Why must settlement record completion only once?\n\n${findings.comprehensionCheck.questions[0].options[0].feedback}`,
      ),
    );
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /exposes comprehensionCheck\.questions\[0\]\.options\[0\]\.feedback/,
    );
  });
});

test("review artifact validator rejects praise, scores, and gamification in self-check feedback", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    writeFileSync(path.join(dir, "implementation-review.md"), validReport());
    const findings = validFindings(dir);
    findings.comprehensionCheck.questions[0].options[0].feedback = "Great job — 10 points.";
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /feedback must stay neutral and unscored/);
  });
});
