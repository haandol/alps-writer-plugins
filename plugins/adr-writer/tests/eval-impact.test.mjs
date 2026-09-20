import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVALS = path.resolve(HERE, "..", "evals");

test("the impact map selects related scenarios without becoming a second contract", async () => {
  const { scenarioNamesForChangedPaths } = await import(path.join(EVALS, "impact-map.mjs"));
  const scenarios = [
    { name: "alps-reference-routes-only-durable-context" },
    { name: "lite-alps-resume-preserves-proposal-first" },
    { name: "feature-handoff-ownership-transfer" },
    { name: "author-keeps-values-and-lints" },
    { name: "impl-review-evidence-package-pass" },
  ];

  assert.deepEqual(
    [...scenarioNamesForChangedPaths(["plugins/alps-writer/src/guides/04.md"], scenarios)].sort(),
    [
      "alps-reference-routes-only-durable-context",
      "feature-handoff-ownership-transfer",
      "lite-alps-resume-preserves-proposal-first",
    ],
  );
  assert.deepEqual(
    [
      ...scenarioNamesForChangedPaths(["plugins/adr-writer/templates/adr/concepts.md"], scenarios),
    ].sort(),
    scenarios.map((scenario) => scenario.name).sort(),
  );
  assert.deepEqual(
    [...scenarioNamesForChangedPaths(["README.md"], scenarios)],
    [],
    "repository prose alone must not trigger live-model evals",
  );
  assert.deepEqual(
    [
      ...scenarioNamesForChangedPaths(
        ["plugins/alps-writer/src/tools/documents/service.ts"],
        scenarios,
      ),
    ].sort(),
    ["alps-reference-routes-only-durable-context", "lite-alps-resume-preserves-proposal-first"],
  );
});

test("changed scenarios select themselves and shared runners select every scenario", async () => {
  const { scenarioNamesForChangedPaths } = await import(path.join(EVALS, "impact-map.mjs"));
  const scenarios = [
    {
      name: "alps-approval-digest-preserves-contract",
      file: "alps-approval-digest-preserves-contract.mjs",
    },
    { name: "lite-alps-resume-preserves-proposal-first" },
    { name: "feature-handoff-ownership-transfer" },
    { name: "impl-plans-without-routine-approval" },
  ];
  assert.deepEqual(
    [
      ...scenarioNamesForChangedPaths(
        ["plugins/adr-writer/evals/scenarios/alps-approval-digest-preserves-contract.mjs"],
        scenarios,
      ),
    ],
    [scenarios[0].name],
  );
  assert.deepEqual(
    [
      ...scenarioNamesForChangedPaths(
        ["plugins\\adr-writer\\evals\\scenarios\\impl-plans-without-routine-approval.mjs"],
        scenarios,
      ),
    ],
    [scenarios[3].name],
  );
  for (const file of ["run.mjs", "impact-map.mjs"]) {
    assert.deepEqual(
      [...scenarioNamesForChangedPaths([`plugins/adr-writer/evals/${file}`], scenarios)],
      scenarios.map((s) => s.name),
    );
  }
  for (const file of ["index.ts", "profiles.ts"]) {
    assert.deepEqual(
      [...scenarioNamesForChangedPaths([`plugins/alps-writer/src/${file}`], scenarios)],
      scenarios.slice(0, 3).map((s) => s.name),
    );
  }
  assert.deepEqual(
    [...scenarioNamesForChangedPaths(["plugins/adr-writer/evals/regression/judge.mjs"], scenarios)],
    [scenarios[0].name],
    "the shared citation validator also affects the semantic digest scorer",
  );
  assert.deepEqual(
    [...scenarioNamesForChangedPaths(["plugins/adr-writer/evals/deepeval/report.mjs"], scenarios)],
    [],
    "the separate regression suite does not select unrelated behavior scenarios",
  );
});

test("the reference-input scenario distinguishes durable constraints from implementation detail", async () => {
  const scenario = (
    await import(path.join(EVALS, "scenarios", "alps-reference-routes-only-durable-context.mjs"))
  ).default;
  const good = scenario.score({
    output: `Section 4.2 Architecture Constraints
- Scale assumption: 500 total users and 10 concurrent users.
- Access boundary: web browser.
- Data boundary: customer documents remain in the contracted region.
- Provider data boundary: the provider must not train on customer content.

승인, 수정, 또는 보류해 주세요.`,
    tail: {
      findings: [
        {
          tag: "DURABLE_CONSTRAINT",
          summary:
            "500 total and 10 concurrent; web browser; contracted region; provider must not train",
        },
        {
          tag: "EPHEMERAL_SOURCE",
          summary: "INC-417, incident log and code paths are not persisted",
        },
        {
          tag: "IMPLEMENTATION_DISCRETION",
          summary:
            "React, Express, MongoDB, LangChain, Bedrock SDK and GitHub Actions stay in code",
        },
        { tag: "APPROVAL_BEFORE_SAVE", summary: "approval is required before save" },
      ],
      raw: "APPROVAL_BEFORE_SAVE | approval is required before save",
    },
  });
  assert.equal(
    good.every((check) => check.pass),
    true,
    good.map((check) => check.detail).join("\n"),
  );

  const bad = scenario.score({
    output:
      "Technology Stack: React, Express, MongoDB, LangChain, Bedrock SDK, GitHub Actions. Ticket INC-417, App.tsx, services/api, ECONNRESET.",
    tail: { findings: [], raw: "" },
  });
  assert.equal(
    bad.some((check) => !check.pass),
    true,
    "a stack inventory copied from the incident must fail the scorer",
  );
});
