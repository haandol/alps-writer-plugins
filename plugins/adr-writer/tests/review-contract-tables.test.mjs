import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PLUGIN_ROOT, withTmp, write } from "./helpers.mjs";

const VALIDATOR = path.join(PLUGIN_ROOT, "scripts/adr-impl-review-validate.mjs");
const MATERIALIZE = path.join(PLUGIN_ROOT, "scripts/adr-impl-review-materialize.mjs");

// Build otherwise valid review artifacts so failures isolate contract accounting.
function validateContract(requirements, bases, { afterContract = "" } = {}) {
  return withTmp((dir) => {
    const adr = write(
      dir,
      "contract.md",
      `# Request completion

## Decision

Requests reuse one durable completion result.

### Requirement contract

${requirements}

### Alternatives

${afterContract}

## Consequences

Retries preserve the stored result.
`,
    );
    const contractCoverage = ["Decision", ...bases].map((adrBasis, index) => ({
      contractId: index === 0 ? "D0" : `R${index}`,
      requirement: index === 0 ? "Durable completion" : `Completion obligation ${index}`,
      status: "PROVEN",
      adrBasis,
      implementation: "The completion boundary reuses the stored result.",
      evidence: "src/completion.mjs:1 — duplicate request reuses the stored result",
      tests: "node --test test/completion.test.mjs — PASS",
    }));
    const hill = {
      id: "H1",
      title: "Retries reuse the completion result",
      sliceType: "user-flow",
      sliceName: "Request completion",
      diagramIds: [],
      diagramOmissionReason: "One reuse guard has a direct observable result.",
      reviewQuestion: "Does a retry reuse the stored result?",
      claim: "A retry returns the stored completion result.",
      workedExample: "Two requests with one key return the same result.",
      counterexample: "A second completion would violate the contract.",
      assessment: "The duplicate-request test covers the reuse boundary.",
      container: {
        responsibility: "Complete each request once.",
        interactions: "The request reaches the completion boundary.",
        outcome: "A retry receives the stored result.",
      },
      components: [
        {
          id: "C1",
          name: "Completion boundary",
          responsibility: "Reuse the stored result for retries.",
          implementation: "Return the existing completion before attempting a write.",
          verification: "Duplicate requests produce one stored result.",
          codeEvidence: [
            {
              kind: "excerpt",
              location: "src/completion.mjs:1",
              content: "return existingResult;",
              explanation: "The retry reuses its completion.",
              tests: "node --test test/completion.test.mjs — PASS",
            },
          ],
        },
      ],
      contractIds: contractCoverage.map((row) => row.contractId),
    };
    const diagnostic = {
      status: "CLEAR",
      assessment: "The completion boundary has executable coverage.",
      evidence: "Duplicate-request test passes.",
    };
    const data = {
      adr,
      language: "en",
      reviewMode: "standard",
      verdict: "PASS",
      report: "implementation-review.md",
      scope: ["src/completion.mjs"],
      changeScope: [],
      atAGlance: {
        impact: "Retries reuse the durable result.",
        action: "None.",
        risk: "None.",
      },
      relatedAdrComparisons: [],
      relatedAdrComparisonOmissionReason: "The fixture contains only this completion decision.",
      diagramRequirements: [],
      implementationChoices: [],
      findings: [],
      contractCoverage,
      reviewHike: {
        context: {
          intent: "Prevent duplicate completion.",
          preconditions: "Requests may be retried.",
          contracts: "Each key has one durable result.",
          scopeAndRisk: "The completion boundary and retry path are reviewed.",
        },
        hills: [hill],
      },
      reviewDiagnostics: {
        contractCompleteness: diagnostic,
        testSufficiency: diagnostic,
        necessity: diagnostic,
      },
    };
    write(dir, "findings.json", JSON.stringify(data));
    write(
      dir,
      "implementation-review.md",
      `# ADR implementation review

## At a glance
<!-- generated from findings.json -->

## Review mode
standard

## Scope
src/completion.mjs

## Context
<!-- generated review context from findings.json -->

## ${hill.title}
${hill.reviewQuestion}

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
node --test test/completion.test.mjs — PASS

## Residual risks
None.
`,
    );
    const materialized = spawnSync(process.execPath, [MATERIALIZE, dir], { encoding: "utf8" });
    assert.equal(materialized.status, 0, materialized.stderr);
    return spawnSync(process.execPath, [VALIDATOR, dir], { encoding: "utf8" });
  });
}

const TABLE = [
  "| Requirement | Observable evidence |",
  "| :--- | ---: |",
  "| Complete **at most once**. | Two retries leave exactly 1 result. |",
  "| Preserve \\| in `pending` results. | Failure leaves the result pending. |",
].join("\n");
const TABLE_BASES = [
  "Complete **at most once**. | Two retries leave exactly 1 result.",
  "Preserve \\| in `pending` results. | Failure leaves the result pending.",
];

test("missing table obligations prevent completion even when Decision is covered", () => {
  const result = validateContract(TABLE, []);
  assert.equal(result.status, 1, result.stdout);
  assert.equal(
    result.stderr,
    "- contractCoverage is missing ADR contract row: R1\n" +
      "- contractCoverage is missing ADR contract row: R2\n",
  );
});

test("complete mixed coverage follows document order across bullets and requirement tables", () => {
  const requirements = `- Preserve the completion key
  across retries.

${TABLE}

* Return the stored result.

#### Failure boundary

Requirement | Observable evidence
--- | ---
Do not complete failed requests. | Failed requests stay pending.

- Keep the failure visible.`;
  const result = validateContract(requirements, [
    "Preserve the completion key across retries.",
    ...TABLE_BASES,
    "Return the stored result.",
    "Do not complete failed requests. | Failed requests stay pending.",
    "Keep the failure visible.",
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /artifacts are valid/);
});

test("normal table spacing and optional outer pipes retain the same source basis", () => {
  for (const table of [
    "| Requirement | Evidence\n| --- | ---\n| Keep  1 result. | Observe `1` result.",
    "Requirement | Evidence |\n--- | --- |\nKeep  1 result. | Observe `1` result. |",
    "   | Requirement | Evidence |\r\n   | :---: | --- |\r\n   | Keep  1 result.   | Observe `1` result. |",
  ]) {
    const result = validateContract(table, ["Keep  1 result. | Observe `1` result."]);
    assert.equal(result.status, 0, result.stderr);
  }
});

test("bullets and headings containing pipes terminate a preceding table", () => {
  const result = validateContract(
    `${TABLE}\n- Preserve success | failure outcomes.\n${TABLE}\n#### Success | failure\n- Return the stored result.`,
    [
      ...TABLE_BASES,
      "Preserve success | failure outcomes.",
      ...TABLE_BASES,
      "Return the stored result.",
    ],
  );
  assert.equal(result.status, 0, result.stderr);
});

test("table coverage must preserve both requirement text and observable evidence exactly", () => {
  for (const alteredBasis of [
    "Complete **at most once**.",
    "Complete twice. | Two retries leave exactly 1 result.",
    "Complete **at most once**. | Two retries leave exactly 2 results.",
  ]) {
    const result = validateContract(TABLE, [alteredBasis, TABLE_BASES[1]]);
    assert.equal(result.status, 1, result.stdout);
    assert.equal(
      result.stderr,
      "- contractCoverage[1].adrBasis must exactly match R1's ADR source row\n",
    );
  }
});

test("Alternatives and fenced example tables do not create requirement obligations", () => {
  const result = validateContract(
    `- Keep the original result.\n\n\`\`\`markdown\n${TABLE}\n\`\`\``,
    ["Keep the original result."],
    { afterContract: TABLE },
  );
  assert.equal(result.status, 0, result.stderr);
});

test("bullet-only coverage keeps existing numbering and continuation text", () => {
  const result = validateContract(
    "- Complete once\n  even after retries.\n\n* Preserve failures.\n- Return the stored result.",
    ["Complete once even after retries.", "Preserve failures.", "Return the stored result."],
  );
  assert.equal(result.status, 0, result.stderr);
});
