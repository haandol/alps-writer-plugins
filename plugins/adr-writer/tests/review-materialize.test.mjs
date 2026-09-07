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

function sourceReport() {
  return `# ADR implementation review

## At a glance

<!-- generated from findings.json -->

## Review mode

full

## Scope

review scope

## ADR intent

Intent.

## The request reaches the boundary

Flow.

## Findings

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
        comprehensionCheck: {
          prGuidance: "Answer before sending the PR.",
          questions: [{ id: "Q1", question: "Why is the boundary preserved?" }],
        },
      }),
    );

    const result = spawnSync(process.execPath, [MATERIALIZE, dir], {
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);

    const report = readFileSync(path.join(dir, "implementation-review.md"), "utf8");
    assert.match(report, /- Verdict: PASS/);
    assert.match(report, /\| D0 \| Met \| A \\\| B \| Implemented \|/);
    assert.match(report, /\| fixed delay \| src\/example\.ts \|/);
    assert.match(report, /1\. Q1 — Why is the boundary preserved\?/);
    assert.match(report, /## The request reaches the boundary\n\nFlow\./);
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
        contractCoverage: [],
        implementationChoices: [],
        comprehensionCheck: {
          prGuidance: "guidance",
          questions: [{ id: "Q1", question: "question" }],
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
        contractCoverage: [],
        implementationChoices: [],
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
