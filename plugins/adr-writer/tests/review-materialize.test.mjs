import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MATERIALIZE = path.join(HERE, "../scripts/adr-impl-review-materialize.mjs");

function withArtifact(run) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "adr-review-materialize-"));
  try {
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function reviewHike(contractIds = ["D0"]) {
  return {
    context: {
      intent: "Preserve the approved request boundary.",
      preconditions: "The request reaches a contract boundary.",
      contracts: "The boundary must preserve the approved behavior.",
      scopeAndRisk: "The request path and its compatibility test are in scope.",
    },
    hills: [
      {
        id: "H1",
        title: "The request reaches the boundary",
        sliceType: "user-flow",
        sliceName: "Contract-bound request",
        reviewQuestion: "Does the request preserve the boundary?",
        claim: "The request preserves the approved boundary.",
        workedExample: "A valid request returns the expected result.",
        counterexample: "Skipping validation would violate the boundary.",
        assessment: "The ideal and compatibility tests support the claim.",
        container: {
          responsibility: "Apply the request contract.",
          interactions: "The caller reaches the boundary and receives a result.",
          outcome: "The caller receives the expected result.",
        },
        components: [
          {
            id: "C1",
            name: "Request boundary",
            responsibility: "Validate and transform the request.",
            implementation: "The vertical request path applies the boundary.",
            verification: "The request test observes the expected caller result.",
            codeEvidence: [
              {
                kind: "diff",
                location: "src/example.ts:1",
                content: "- oldBoundary(request)\n+ applyBoundary(request)",
                explanation: "The request uses the contract-preserving boundary.",
                tests: "node --test — PASS",
              },
            ],
          },
        ],
        contractIds,
      },
    ],
  };
}

function sourceReport() {
  return `# ADR implementation review

## At a glance

<!-- generated from findings.json -->

## Review mode

full

## Scope

review scope

## Context

<!-- generated review context from findings.json -->

## The request reaches the boundary

Does the request preserve the boundary?

<!-- generated container zoom from findings.json -->

<!-- generated component zoom from findings.json -->

<!-- generated hill evidence from findings.json -->

## Findings

<!-- generated review diagnostics from findings.json -->

None.

## ADR contract coverage

<!-- generated from findings.json -->

## Notable implementation choices

<!-- generated from findings.json -->

## Tests

node --test — PASS

## Residual risks

None.

## Comprehension check

<!-- generated from findings.json -->
`;
}

test("materializer creates the complete Markdown evidence sections from findings JSON", () => {
  withArtifact((dir) => {
    writeFileSync(path.join(dir, "implementation-review.md"), sourceReport());
    writeFileSync(
      path.join(dir, "findings.json"),
      JSON.stringify({
        language: "en",
        verdict: "PASS",
        atAGlance: {
          impact: "No behavior regression.",
          action: "None.",
          risk: "None.",
        },
        reviewHike: reviewHike(),
        contractCoverage: [
          {
            contractId: "D0",
            requirement: "A | B",
            status: "PROVEN",
            adrBasis: "Decision",
            implementation: "Implemented",
            evidence: "src/example.ts",
            tests: "node --test — PASS",
          },
        ],
        implementationChoices: [
          {
            choice: "fixed delay",
            evidence: "src/example.ts",
            intentFit: "preserves the boundary",
            whyItMatters: "latency",
          },
        ],
        reviewDiagnostics: {
          contractCompleteness: {
            status: "CLEAR",
            assessment: "Every reviewed behavior has a contract row.",
            evidence: "D0 is assigned once.",
          },
          testSufficiency: {
            status: "CLEAR",
            assessment: "The ideal and boundary tests pass.",
            evidence: "node --test — PASS",
          },
          necessity: {
            status: "CLEAR",
            assessment: "No removable change was found.",
            evidence: "The necessity pass found no excess scope.",
          },
        },
        comprehensionCheck: {
          prGuidance: "Answer before sending the PR.",
          questions: [
            {
              id: "Q1",
              question: "Which result preserves the boundary?",
              options: [
                { id: "A", text: "Skip validation", feedback: "Validation is required." },
                {
                  id: "B",
                  text: "Return the expected result",
                  feedback: "This preserves the boundary.",
                },
                { id: "C", text: "Change the output", feedback: "That breaks compatibility." },
                { id: "D", text: "Ignore errors", feedback: "Errors remain part of the contract." },
              ],
              correctOptionId: "B",
              explanation: "The valid request must return the expected result.",
              evidence: "src/example.ts and node --test",
            },
          ],
        },
      }),
    );

    const result = spawnSync(process.execPath, [MATERIALIZE, dir], {
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);

    const report = readFileSync(path.join(dir, "implementation-review.md"), "utf8");
    assert.match(report, /No behavior regression\.[\s\S]*PASS\./);
    assert.match(report, /\| D0 \| Met \| H1 \| A \\\| B \|/);
    assert.match(report, /### D0 · Met · A \\\| B/);
    assert.match(report, /\*\*Implementation\.\*\* Implemented/);
    assert.match(report, /\*\*Evidence\.\*\* src\/example\.ts/);
    assert.match(report, /\*\*Tests\.\*\* node --test — PASS/);
    assert.doesNotMatch(report, /\*\*Intent\.\*\*/);
    assert.match(report, /The request reaches a contract boundary\./);
    assert.doesNotMatch(report, /\*\*Vertical slice\.\*\*/);
    const containerBlock = report.match(
      /<!-- generated container zoom start -->([\s\S]*?)<!-- generated container zoom end -->/,
    )?.[1];
    assert.doesNotMatch(containerBlock, /\*\*Responsibility\.\*\*/);
    assert.match(report, /### Component C1 · Request boundary/);
    assert.match(report, /```diff[\s\S]*- oldBoundary\(request\)/);
    assert.match(report, /\| fixed delay \| src\/example\.ts \|/);
    assert.match(report, /1\. Q1 — Which result preserves the boundary\?/);
    assert.match(report, /- B\. Return the expected result/);
    assert.match(
      report,
      /## The request reaches the boundary[\s\S]*The request test observes the expected caller result\./,
    );
    assert.doesNotMatch(report, /generated from findings\.json/);

    const secondResult = spawnSync(process.execPath, [MATERIALIZE, dir], {
      encoding: "utf8",
    });
    assert.equal(secondResult.status, 0, secondResult.stderr);
    assert.equal(
      readFileSync(path.join(dir, "implementation-review.md"), "utf8"),
      report,
      "materialization should be idempotent",
    );
  });
});

test("materializer rejects a report whose generated section anchor is missing", () => {
  withArtifact((dir) => {
    writeFileSync(
      path.join(dir, "implementation-review.md"),
      sourceReport().replace("## ADR contract coverage", "## Coverage"),
    );
    writeFileSync(
      path.join(dir, "findings.json"),
      JSON.stringify({
        verdict: "PASS",
        atAGlance: { impact: "none", action: "none", risk: "none" },
        reviewHike: reviewHike([]),
        contractCoverage: [],
        implementationChoices: [],
        reviewDiagnostics: {
          contractCompleteness: { status: "CLEAR", assessment: "clear", evidence: "none" },
          testSufficiency: { status: "CLEAR", assessment: "clear", evidence: "none" },
          necessity: { status: "CLEAR", assessment: "clear", evidence: "none" },
        },
        reviewDiagnostics: {
          contractCompleteness: { status: "CLEAR", assessment: "clear", evidence: "D0" },
          testSufficiency: { status: "CLEAR", assessment: "clear", evidence: "test" },
          necessity: { status: "CLEAR", assessment: "clear", evidence: "diff" },
        },
        comprehensionCheck: {
          prGuidance: "guidance",
          questions: [
            {
              id: "Q1",
              question: "question",
              options: [
                { id: "A", text: "a", feedback: "a" },
                { id: "B", text: "b", feedback: "b" },
                { id: "C", text: "c", feedback: "c" },
                { id: "D", text: "d", feedback: "d" },
              ],
              correctOptionId: "A",
              explanation: "because",
              evidence: "evidence",
            },
          ],
        },
      }),
    );

    const result = spawnSync(process.execPath, [MATERIALIZE, dir], {
      encoding: "utf8",
    });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /missing: ## ADR contract coverage/);
  });
});

test("materializer leaves comprehension absent when no questions were requested", () => {
  withArtifact((dir) => {
    writeFileSync(
      path.join(dir, "implementation-review.md"),
      sourceReport().replace(/## Comprehension check[\s\S]*$/, ""),
    );
    writeFileSync(
      path.join(dir, "findings.json"),
      JSON.stringify({
        language: "en",
        verdict: "PASS",
        atAGlance: { impact: "none", action: "none", risk: "none" },
        reviewHike: reviewHike([]),
        contractCoverage: [],
        implementationChoices: [],
        reviewDiagnostics: {
          contractCompleteness: { status: "CLEAR", assessment: "clear", evidence: "none" },
          testSufficiency: { status: "CLEAR", assessment: "clear", evidence: "none" },
          necessity: { status: "CLEAR", assessment: "clear", evidence: "none" },
        },
      }),
    );

    const result = spawnSync(process.execPath, [MATERIALIZE, dir], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(
      readFileSync(path.join(dir, "implementation-review.md"), "utf8"),
      /Comprehension check/,
    );
  });
});

test("materializer localizes Hill evidence labels for Korean reports", () => {
  withArtifact((dir) => {
    writeFileSync(path.join(dir, "implementation-review.md"), sourceReport());
    writeFileSync(
      path.join(dir, "findings.json"),
      JSON.stringify({
        language: "ko",
        verdict: "PASS",
        atAGlance: { impact: "없음", action: "없음", risk: "없음" },
        reviewHike: reviewHike(),
        contractCoverage: [
          {
            contractId: "D0",
            requirement: "경계를 보존한다",
            status: "PROVEN",
            adrBasis: "Decision",
            implementation: "경계를 보존한다",
            evidence: "src/example.ts",
            tests: "node --test — PASS",
          },
        ],
        implementationChoices: [],
        reviewDiagnostics: {
          contractCompleteness: { status: "CLEAR", assessment: "누락 없음", evidence: "D0" },
          testSufficiency: { status: "CLEAR", assessment: "공백 없음", evidence: "테스트" },
          necessity: { status: "CLEAR", assessment: "과다 없음", evidence: "diff" },
        },
      }),
    );

    const result = spawnSync(process.execPath, [MATERIALIZE, dir], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);

    const report = readFileSync(path.join(dir, "implementation-review.md"), "utf8");
    assert.match(report, /\*\*구현\.\*\* 경계를 보존한다/);
    assert.match(report, /\*\*근거\.\*\* src\/example\.ts/);
    assert.match(report, /\*\*테스트\.\*\* node --test — PASS/);
    assert.doesNotMatch(report, /\*\*Implementation\.\*\*/);
  });
});
