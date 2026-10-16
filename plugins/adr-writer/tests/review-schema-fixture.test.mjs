import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PLUGIN_ROOT, withTmp, write } from "./helpers.mjs";
import { skillText } from "../evals/lib/harness.mjs";

const schemaPath = "skills/adr-impl-review/references/artifact-schema.md";
const schema = readFileSync(path.join(PLUGIN_ROOT, schemaPath), "utf8");
const mandatorySection = schema.split("### Required top-level fields\n")[1]?.split("### ")[0];
assert.ok(mandatorySection, "the mandatory schema must enumerate top-level fields");
const mandatoryFields = [...mandatorySection.matchAll(/^\| `(\w+)`\s*\|/gm)].map((m) => m[1]);
const separator = JSON.parse(schema.match(/with the literal separator `([^`]+)`/)?.[1]);
const run = (script, dir) =>
  spawnSync(process.execPath, [path.join(PLUGIN_ROOT, "scripts", script), dir], {
    encoding: "utf8",
  });
const materialize = (dir) => run("adr-impl-review-materialize.mjs", dir);
const validate = (dir) => run("adr-impl-review-validate.mjs", dir);

function runAdmissionTest(dir) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const execution = spawnSync(process.execPath, ["--test", "test/admission.test.mjs"], {
    cwd: dir,
    encoding: "utf8",
    env,
  });
  assert.match(execution.stdout, /admit below the two-request limit, reject at and above it/);
  assert.doesNotMatch(execution.stderr, /recursively|skipping running files/);
  return execution;
}

// Build from the mandatory documentation plus this independent domain fixture.
// No optional worked JSON or existing validFindings fixture supplies missing keys.
function fixture(dir) {
  assert.match(schema, /Set `D0\.adrBasis`\s+to the literal `Decision`/);
  assert.match(schema, /Component ids are sequential\s+`C1\.\.Cn`, restarting within each Hill/);
  const code = "export const canAdmit = (count) => count < 2;";
  const source = write(dir, "src/admission.mjs", `${code}\n`);
  write(
    dir,
    "test/admission.test.mjs",
    `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canAdmit } from '../src/admission.mjs';
test('admit below the two-request limit, reject at and above it', () => {
  assert.equal(canAdmit(0), true);
  assert.equal(canAdmit(1), true);
  assert.equal(canAdmit(2), false);
  assert.equal(canAdmit(3), false);
});\n`,
  );
  const execution = runAdmissionTest(dir);
  assert.equal(execution.status, 0, execution.stderr);
  const testResult = "node --test test/admission.test.mjs — PASS";
  const cells = [
    "Admit only while fewer than 2 requests are active.",
    "Counts 0 and 1 admit; counts 2 and 3 reject.",
  ];
  const adr = write(
    dir,
    "contract.md",
    `# Request admission

## Decision
Apply the two-request admission boundary.

### Requirement contract
| Requirement | Observable evidence |
| --- | --- |
|   ${cells[0]}  | ${cells[1]}   |

## Consequences
Requests at capacity are rejected.
`,
  );
  const evidence =
    "src/admission.mjs:1 — count < 2; assertions cover counts 0, 1, 2 and 3 with true, true, false and false results.";
  const coverage = [
    {
      contractId: "D0",
      requirement: "Apply the two-request admission boundary.",
      adrBasis: "Decision",
    },
    { contractId: "R1", requirement: cells[0], adrBasis: cells.join(separator) },
  ].map((row) => ({
    ...row,
    status: "PROVEN",
    implementation: "The admission predicate compares the active count with 2.",
    evidence,
    tests: testResult,
  }));
  const hill = {
    id: "H1",
    title: "Admission stops at two active requests",
    sliceType: "logical-capability",
    sliceName: "Request admission",
    reviewQuestion: "Does admission reject a request at capacity?",
    claim: "Admission stops when two requests are active.",
    workedExample: "One active request admits another; two active requests reject it.",
    counterexample: "Using count <= 2 would incorrectly admit the boundary case.",
    assessment: "Executed assertions cover both sides of the boundary.",
    diagramIds: [],
    diagramOmissionReason: "The single comparison is clear in prose.",
    container: {
      responsibility: "Enforce the admission boundary.",
      interactions: "The caller supplies the active count.",
      outcome: "Requests at capacity are rejected.",
    },
    components: [
      {
        id: "C1",
        name: "Admission predicate",
        responsibility: "Compare the count with the limit.",
        implementation: "Return count < 2.",
        verification: testResult,
        codeEvidence: [
          {
            kind: "excerpt",
            location: `${source}:1`,
            content: code,
            explanation: "The unchanged comparison rejects counts at or above 2.",
            tests: testResult,
          },
        ],
      },
    ],
    contractIds: ["D0", "R1"],
  };
  const values = {
    language: "en",
    reviewMode: "standard",
    adr,
    verdict: "PASS",
    report: "implementation-review.md",
    scope: ["src/admission.mjs", "test/admission.test.mjs"],
    changeScope: [],
    atAGlance: {
      impact: "Requests at capacity are rejected.",
      action: "None.",
      risk: "The fixture checks the admission predicate only.",
    },
    relatedAdrComparisons: [],
    diagramRequirements: [],
    reviewHike: {
      context: {
        intent: "Enforce the two-request limit.",
        preconditions: "The caller supplies an active count.",
        contracts: "Admit below 2; reject at or above 2.",
        scopeAndRisk: "The admission predicate and its boundary assertions are covered.",
      },
      hills: [hill],
    },
    reviewDiagnostics: {
      contractCompleteness: {
        status: "CLEAR",
        assessment: "D0 and R1 account for the admission rule.",
        evidence,
      },
      testSufficiency: {
        status: "CLEAR",
        assessment: "Boundary assertions ran successfully.",
        evidence: testResult,
      },
      necessity: {
        status: "UNVERIFIED",
        assessment: "No independent necessity perspective in standard mode.",
        evidence: "Standard sufficiency review; changeScope is empty.",
      },
    },
    contractCoverage: coverage,
    implementationChoices: [],
    findings: [],
  };
  // If documentation drops a required key, fail rather than rescue the fixture
  // from a copied payload. New documented keys likewise need meaningful values.
  assert.deepEqual([...mandatoryFields].sort(), Object.keys(values).sort());
  const data = Object.fromEntries(mandatoryFields.map((key) => [key, values[key]]));
  assert.match(mandatorySection, /`relatedAdrComparisonOmissionReason` is conditionally required/);
  data.relatedAdrComparisonOmissionReason = "The fixture has only one ADR.";
  write(dir, "findings.json", JSON.stringify(data));

  const anchorsText = schema.match(/anchors in order: ([\s\S]*?)\n`## Comprehension check`/)?.[1];
  assert.ok(anchorsText, "the schema must supply the required narrative anchors");
  const anchors = [...anchorsText.matchAll(/`(## [^`]+)`/g)].map((m) => m[1]);
  const generic = "<!-- generated from findings.json -->";
  const reportBodies = new Map([
    ["## At a glance", generic],
    ["## Review mode", data.reviewMode],
    ["## Scope", `Complete scope: ${data.scope.join(", ")}. Change scope: none.`],
    [
      "## Context",
      `<!-- generated review context from findings.json -->\n\n## ${hill.title}\n${hill.reviewQuestion}\n\n<!-- generated container zoom from findings.json -->\n\n<!-- generated component zoom from findings.json -->\n\n<!-- generated hill evidence from findings.json -->`,
    ],
    ["## Findings", "<!-- generated review diagnostics from findings.json -->\n\nNone."],
    ["## ADR contract coverage", generic],
    ["## Notable implementation choices", generic],
    ["## Tests", testResult],
    ["## Residual risks", data.atAGlance.risk],
  ]);
  assert.deepEqual(anchors, [...reportBodies.keys()]);
  for (const marker of [
    generic,
    "<!-- generated review diagnostics from findings.json -->",
    "<!-- generated review context from findings.json -->",
    "<!-- generated container zoom from findings.json -->",
    "<!-- generated component zoom from findings.json -->",
    "<!-- generated hill evidence from findings.json -->",
  ])
    assert.ok(schema.includes(marker), `undocumented generated marker: ${marker}`);
  write(
    dir,
    "implementation-review.md",
    `# ADR implementation review\n\n${anchors.map((h) => `${h}\n${reportBodies.get(h)}`).join("\n\n")}\n`,
  );
  return data;
}

test("mandatory schema alone produces materializable and valid artifacts with exact table basis", () => {
  const prompt = skillText("adr-impl-review", {
    references: ["skills/adr-impl-review/references/artifact-contract.md", schemaPath],
  });
  assert.ok(prompt.includes(schema));
  assert.doesNotMatch(prompt, /# Loaded reference: .*artifact-example\.md/);
  assert.doesNotMatch(prompt, /# Implementation review artifact example/);
  assert.equal(separator, " | ");
  withTmp((dir) => {
    const data = fixture(dir);
    for (const field of ["metrics", "explanation", "comprehensionCheck", "title"])
      assert.ok(!(field in data));
    const result = materialize(dir);
    assert.equal(result.status, 0, result.stderr);
    const validation = validate(dir);
    assert.equal(validation.status, 0, validation.stderr);
    const report = readFileSync(path.join(dir, "implementation-review.md"), "utf8");
    for (const diagnostic of Object.values(data.reviewDiagnostics))
      assert.ok(report.includes(diagnostic.assessment));
    assert.doesNotMatch(report, /## Comprehension check/);
  });
});

test("missing diagnostics is rejected before materialization and independently by validation", () => {
  withTmp((dir) => {
    const data = fixture(dir);
    assert.equal(materialize(dir).status, 0);
    const valid = validate(dir);
    assert.equal(valid.status, 0, valid.stderr);
    const reportPath = path.join(dir, "implementation-review.md");
    const report = readFileSync(reportPath, "utf8");
    delete data.reviewDiagnostics;
    write(dir, "findings.json", JSON.stringify(data));
    const result = materialize(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /reviewDiagnostics must be an object/);
    assert.equal(readFileSync(reportPath, "utf8"), report);
    const validation = validate(dir);
    assert.equal(validation.status, 1);
    assert.match(validation.stderr, /reviewDiagnostics must be an object/);
  });
});

test("the validator rejects missing diagnostic entries and invalid nested diagnostic fields", () => {
  withTmp((dir) => {
    const data = fixture(dir);
    assert.equal(materialize(dir).status, 0);
    const valid = validate(dir);
    assert.equal(valid.status, 0, valid.stderr);
    for (const name of ["contractCompleteness", "testSufficiency", "necessity"]) {
      assert.ok(schema.includes(`\`${name}\``));
      for (const mutate of [
        (value) => {
          delete value.reviewDiagnostics[name];
        },
        (value) => {
          value.reviewDiagnostics[name].status = "PROVEN";
        },
        (value) => {
          delete value.reviewDiagnostics[name].assessment;
        },
        (value) => {
          delete value.reviewDiagnostics[name].evidence;
        },
      ]) {
        const invalid = structuredClone(data);
        mutate(invalid);
        write(dir, "findings.json", JSON.stringify(invalid));
        const result = validate(dir);
        assert.equal(result.status, 1);
        assert.ok(result.stderr.includes(`reviewDiagnostics.${name}`), result.stderr);
      }
    }
  });
});

test("unspaced table basis and omitted report or scope fields remain invalid", () => {
  withTmp((dir) => {
    const data = fixture(dir);
    assert.equal(materialize(dir).status, 0);
    const valid = validate(dir);
    assert.equal(valid.status, 0, valid.stderr);
    for (const mutate of [
      (value) => {
        value.contractCoverage[1].adrBasis = value.contractCoverage[1].adrBasis.replaceAll(
          separator,
          "|",
        );
      },
      ...["report", "scope", "changeScope"].map((key) => (value) => {
        delete value[key];
      }),
    ]) {
      const invalid = structuredClone(data);
      mutate(invalid);
      write(dir, "findings.json", JSON.stringify(invalid));
      const result = validate(dir);
      assert.equal(result.status, 1);
      assert.match(
        result.stderr,
        /adrBasis must exactly match R1|report must point|scope must be an array|changeScope must be an array/,
      );
    }
  });
});

test("all table normalization instruction owners specify the validator's literal separator", () => {
  for (const file of [
    schemaPath,
    "skills/adr-impl-review/references/evidence-synthesis.md",
    "agents/adr-impl-sufficiency-reviewer.md",
  ]) {
    const source = readFileSync(path.join(PLUGIN_ROOT, file), "utf8");
    assert.equal(
      JSON.parse(source.match(/with the literal separator `([^`]+)`/)?.[1]),
      separator,
      file,
    );
    assert.doesNotMatch(source, /cells with `\|`/);
  }
});

for (const verdict of ["FIX_REQUIRED", "BLOCK"]) {
  test(`${verdict} requires numbered finding headings and literal repair labels`, () => {
    const repair = readFileSync(
      path.join(PLUGIN_ROOT, "skills/adr-impl-review/references/repair-guide.md"),
      "utf8",
    );
    const labels = [
      "## Repair guide",
      "Files and symbols to change:",
      "Scope not to touch:",
      "Completion criteria:",
      "Needs confirmation:",
    ];
    for (const owner of [schema, repair]) {
      assert.ok(owner.includes("### F1. <finding summary>"));
      for (const label of labels) assert.ok(owner.includes(label));
    }
    withTmp((dir) => {
      const data = fixture(dir);
      const command = "node --test test/admission.test.mjs";
      const testResult = `${command} — ${verdict === "FIX_REQUIRED" ? "FAIL: count 2 incorrectly admitted" : "PASS"}`;
      let evidence;
      if (verdict === "FIX_REQUIRED") {
        write(dir, "src/admission.mjs", "export const canAdmit = (count) => count <= 2;\n");
        const execution = runAdmissionTest(dir);
        assert.equal(execution.status, 1, execution.stderr);
        evidence =
          "src/admission.mjs:1 — count <= 2 admits count 2; the executed assertion expected false and received true.";
        data.changeScope = ["src/admission.mjs"];
        const component = data.reviewHike.hills[0].components[0];
        component.implementation = "Return count <= 2, admitting a request at capacity.";
        component.verification = testResult;
        component.codeEvidence[0] = {
          kind: "diff",
          location: "src/admission.mjs:1",
          content:
            "-export const canAdmit = (count) => count < 2;\n+export const canAdmit = (count) => count <= 2;",
          explanation: "The changed comparison admits the forbidden capacity case.",
          tests: testResult,
        };
        for (const row of data.contractCoverage)
          Object.assign(row, {
            status: "VIOLATED",
            implementation: component.implementation,
            evidence,
            tests: testResult,
          });
        data.reviewDiagnostics.testSufficiency = {
          status: "ISSUE",
          assessment: "The boundary assertion fails.",
          evidence: testResult,
        };
      } else {
        const clause = "A request at count 2 must be admitted.";
        write(dir, "contract.md", `${readFileSync(data.adr, "utf8")}\n${clause}\n`);
        evidence = `The Requirement contract rejects count 2, but Consequences says: ${clause}`;
        Object.assign(data.contractCoverage[0], { status: "CONTRADICTED", evidence });
        data.reviewDiagnostics.contractCompleteness = {
          status: "ISSUE",
          assessment: "The boundary has contradictory requirements.",
          evidence,
        };
      }
      data.verdict = verdict;
      data.atAGlance.action =
        verdict === "FIX_REQUIRED"
          ? "Restore rejection at capacity."
          : "Resolve the contradictory admission rule.";
      data.reviewHike.hills[0].assessment = evidence;
      data.findings = [
        {
          category: verdict === "FIX_REQUIRED" ? "Spec violation" : "Contradiction",
          perspective: "sufficiency",
          summary: "Admission at capacity needs correction",
          confidence: "high",
          code: "src/admission.mjs:1",
          evidence,
          test: command,
          testResult,
          contractIds: ["D0", "R1"],
        },
      ];
      write(dir, "findings.json", JSON.stringify(data));
      const reportPath = path.join(dir, "implementation-review.md");
      const ordinaryHeading = "### Admission at capacity needs correction";
      let source = readFileSync(reportPath, "utf8")
        .replace(
          "<!-- generated review diagnostics from findings.json -->\n\nNone.",
          `<!-- generated review diagnostics from findings.json -->\n\n${ordinaryHeading}\n${evidence}`,
        )
        .replace(`## Tests\n${command} — PASS`, `## Tests\n${testResult}`);
      if (verdict === "FIX_REQUIRED")
        source = source.replace("Change scope: none.", "Change scope: src/admission.mjs.");
      source += `\n## Repair guide\n\nFiles and symbols to change: ${verdict === "FIX_REQUIRED" ? "src/admission.mjs: canAdmit" : "contract.md: Consequences, after a human decision"}\n\nScope not to touch: unrelated callers.\n\nCompletion criteria: ${verdict === "FIX_REQUIRED" ? "Counts 0 and 1 admit, counts 2 and 3 reject, and the boundary test passes." : "The human resolves the contradictory boundary; code and tests then follow that decision."}\n\nNeeds confirmation: ${verdict === "FIX_REQUIRED" ? "None; the recorded limit remains 2." : "Which count-2 behavior is required."}\n`;
      write(dir, "implementation-review.md", source);
      const materialized = materialize(dir);
      assert.equal(materialized.status, 0, materialized.stderr);
      const rejected = validate(dir);
      assert.equal(rejected.status, 1);
      assert.equal(
        rejected.stderr,
        "- implementation-review.md has 0 finding sections for 1 findings\n",
      );

      // Change only the heading: evidence, verdict, repair text and JSON stay fixed.
      const ordinary = readFileSync(reportPath, "utf8");
      assert.ok(ordinary.includes(ordinaryHeading));
      const numbered = ordinary.replace(ordinaryHeading, `### F1. ${data.findings[0].summary}`);
      write(dir, "implementation-review.md", numbered);
      const accepted = validate(dir);
      assert.equal(accepted.status, 0, accepted.stderr);
      for (const label of labels) {
        write(dir, "implementation-review.md", numbered.replace(label, "Omitted repair label"));
        const missing = validate(dir);
        assert.equal(missing.status, 1);
        assert.equal(missing.stderr, `- implementation-review.md missing: ${label}\n`);
      }
      // The runtime counts matching headings, without requiring F1 specifically.
      write(dir, "implementation-review.md", numbered.replace("### F1. ", "### F7. "));
      const nonSequential = validate(dir);
      assert.equal(nonSequential.status, 0, nonSequential.stderr);
    });
  });
}

function compactFixture(dir) {
  const data = fixture(dir);
  const original = data.reviewHike.hills[0];
  data.reviewHike = {
    context: { summary: Object.values(data.reviewHike.context).join(" ") },
    hills: [
      {
        id: "H1",
        title: original.title,
        claim: original.claim,
        contractIds: original.contractIds,
        codeEvidence: original.components[0].codeEvidence,
      },
    ],
  };
  delete data.relatedAdrComparisons;
  delete data.relatedAdrComparisonOmissionReason;
  delete data.diagramRequirements;
  write(dir, "findings.json", JSON.stringify(data));
  return data;
}

test("compact standard preserves exact contract and code evidence through direct HTML delivery", () => {
  withTmp((dir) => {
    const data = compactFixture(dir);
    assert.equal(materialize(dir).status, 0);
    const checked = validate(dir);
    assert.equal(checked.status, 0, checked.stderr);
    const output = path.join(dir, "report.html");
    const rendered = spawnSync(
      process.execPath,
      [
        path.join(PLUGIN_ROOT, "scripts/adr-impl-review-article.mjs"),
        path.join(dir, "findings.json"),
        output,
      ],
      { encoding: "utf8" },
    );
    assert.equal(rendered.status, 0, rendered.stderr);
    const html = readFileSync(output, "utf8");
    for (const row of data.contractCoverage) assert.ok(html.includes(row.requirement));
    assert.ok(html.includes("count &lt; 2"));
    assert.ok(html.includes("test/admission.test.mjs"));
    assert.doesNotMatch(html, /Component C1/);
    assert.match(html, /Purpose/);
    assert.match(html, /Context/);
  });
});

test("compact presentation cannot bypass evidence, full-mode depth, or PASS gates", () => {
  for (const mutate of [
    (d) => {
      d.reviewHike.hills[0].codeEvidence = [];
    },
    (d) => {
      delete d.reviewHike.hills[0].codeEvidence[0].tests;
    },
    (d) => {
      d.reviewHike.hills[0].contractIds.pop();
    },
    (d) => {
      d.reviewHike.hills[0].contractIds.push("R1");
    },
    (d) => {
      d.contractCoverage[1].status = "UNVERIFIED";
    },
    (d) => {
      d.reviewMode = "full";
    },
    (d) => {
      d.changeScope = ["src/admission.mjs"];
    },
    (d) => {
      d.diagramRequirements = [
        {
          id: "V1",
          question: "Where?",
          diagramType: "flowchart",
          section: d.reviewHike.hills[0].title,
          reason: "Relationships",
          evidence: "source",
        },
      ];
    },
    (d) => {
      d.relatedAdrComparisons = [{}];
    },
    (d) => {
      d.reviewHike.hills[0].diagramOmissionReason = 17;
    },
  ])
    withTmp((dir) => {
      const data = compactFixture(dir);
      mutate(data);
      write(dir, "findings.json", JSON.stringify(data));
      materialize(dir);
      const result = validate(dir);
      assert.notEqual(result.status, 0, "invalid compact evidence must fail");
    });
});

test("an authored direct flag cannot bypass full component validation", () => {
  withTmp((dir) => {
    const data = fixture(dir);
    data.reviewMode = "full";
    const component = data.reviewHike.hills[0].components[0];
    component.direct = true;
    delete component.responsibility;
    write(dir, "findings.json", JSON.stringify(data));
    materialize(dir);
    const result = validate(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /responsibility/);
  });
});

test("direct delivery refuses invalid evidence and preserves selected rich interactions", async () => {
  const { standardArticle } = await import("../scripts/adr-impl-review-article.mjs");
  withTmp((dir) => {
    const data = compactFixture(dir);
    for (const category of [
      "Decision changed in code",
      "Undecided behavior",
      "Unverified risk",
      "Contradiction",
    ]) {
      assert.throws(
        () => standardArticle({ ...data, findings: [{ category }] }, "findings.json"),
        /rich report composition/,
      );
    }
    assert.throws(
      () => standardArticle({ ...data, diagramRequirements: [{}] }, "findings.json"),
      /rich report composition/,
    );
    assert.throws(
      () => standardArticle({ ...data, comprehensionCheck: { questions: [{}] } }, "findings.json"),
      /rich report composition/,
    );
    data.contractCoverage[1].status = "UNVERIFIED";
    write(dir, "findings.json", JSON.stringify(data));
    materialize(dir);
    const output = path.join(dir, "report.html");
    const result = spawnSync(
      process.execPath,
      [
        path.join(PLUGIN_ROOT, "scripts/adr-impl-review-article.mjs"),
        path.join(dir, "findings.json"),
        output,
      ],
      { encoding: "utf8" },
    );
    assert.notEqual(result.status, 0);
    assert.equal(existsSync(output), false);
  });
});
