import { test } from "node:test";
import assert from "node:assert/strict";
import scenario, {
  discoveryCases,
  fixtureFiles,
  obligations,
} from "../evals/scenarios/rollup-targeted-discovery.mjs";
import { catalog } from "../evals/skills/catalog.mjs";
import { deepEvalInput } from "../evals/deepeval/input.mjs";
import { scenarioNamesForChangedPaths } from "../evals/impact-map.mjs";

function answer() {
  const billing = [
    "docs/adr/.mapping.json",
    "docs/adr/billing/0001-retry-limit.md",
    "docs/adr/billing/0003-retry-limit.md",
    "docs/adr/billing/0005-retry-limit.md",
    "docs/adr/billing/0002-payment-identity.md",
    "src/retry.mjs",
    "test/retry.test.mjs",
  ];
  return [
    {
      id: "clear-chain",
      inspect: billing,
      reuse: [],
      diagram: "none",
      reason:
        "Read each adopted retry transition and the stable payment identity owner before preparing the five-retry survivor.",
    },
    {
      id: "residual-owner",
      inspect: [
        "docs/adr/.mapping.json",
        "docs/adr/storage/0001-retention.md",
        "docs/adr/storage/0002-retention.md",
        "docs/adr/compliance/0001-deletion-clearance.md",
        "docs/adr/compliance/0002-audit-state.md",
        "src/retention.mjs",
        "test/retention.test.mjs",
      ],
      reuse: [],
      diagram: "candidate-local",
      reason:
        "Clearance delegates allowed states to the audit decision, so inspect that owner too. Preserve regulated retention and the open-audit deletion block.",
    },
    {
      id: "unchanged-evidence",
      inspect: [],
      reuse: [...billing],
      diagram: "none",
      reason:
        "The captured originals and candidate checks have unchanged inputs; reuse them and still compare every affected source and destination before apply.",
    },
    {
      id: "no-argument-all",
      inspect: [
        ...billing,
        "docs/adr/storage/0001-retention.md",
        "docs/adr/storage/0002-retention.md",
        "docs/adr/compliance/0001-deletion-clearance.md",
        "docs/adr/compliance/0002-audit-state.md",
        "docs/adr/notifications/0001-delivery.md",
        "src/retention.mjs",
        "test/retention.test.mjs",
      ],
      reuse: [],
      diagram: "none",
      reason:
        "Read all indexed ADRs to identify the billing and storage chains; compliance and notification decisions remain independent, so notifications need no implementation discovery.",
    },
  ].map((row) => ({
    ...row,
    globalChecks: ["index", "links", "cycles", "invariants"],
    action: "prepare",
    approval: "exact-changeset",
    freshness: "all-affected-sources-and-destinations",
  }));
}

const output = (rows) => `\`\`\`json\n${JSON.stringify(rows)}\n\`\`\``;

test("raw inputs are independently exportable and judge expectations do not leak to the target", () => {
  const data = JSON.parse(JSON.stringify({ files: fixtureFiles, snapshots: discoveryCases }));
  const prompt = scenario.build();
  assert.ok(prompt.includes(JSON.stringify(data, null, 2)));
  for (const rule of obligations) assert.ok(!prompt.includes(rule.text));
  for (const row of answer())
    for (const path of [...row.inspect, ...row.reuse])
      assert.equal(typeof data.files[path], "string", `missing raw file ${path}`);
  assert.deepEqual(data.snapshots[2].priorEvidence.files.sort(), answer()[2].reuse.sort());
});

test("the catalog judges the probe by its semantic obligations, with no mechanical scorer attached", async () => {
  const entry = (await catalog()).find((item) => item.id === scenario.name);
  assert.equal(entry.score, undefined);
  assert.equal(entry.supplementalChecks, false);
  assert.deepEqual(entry.semanticObligations, obligations);

  // Correct path records cannot prove prose meaning. Preserve contradictory
  // prose and raw originals for the separate semantic judge, with no SDK call.
  const reply = `First I will map every business context and deployable. I will keep only the newest retry limit and omit payment identity.\n${output(answer())}`;
  const turns = [scenario.build()];
  const input = deepEvalInput(
    { skill: "adr-rollup", obligations, turns },
    {
      before: fixtureFiles,
      after: fixtureFiles,
      events: [],
      replies: [reply],
      turns,
    },
  );
  assert.deepEqual(JSON.parse(input.input).originalFiles, fixtureFiles);
  assert.equal(JSON.parse(input.actualOutput).replies[0], reply);
  assert.deepEqual(JSON.parse(input.expectedOutput).obligations, obligations);
});

test("rollup and scoped presentation changes select the new probe without unrelated scenarios", () => {
  for (const path of [
    "plugins/adr-writer/skills/adr-rollup/SKILL.md",
    "plugins/adr-writer/evals/scenarios/rollup-targeted-discovery.mjs",
  ]) {
    assert.deepEqual(
      [...scenarioNamesForChangedPaths([path], [scenario, { name: "hook-admission-routing" }])],
      [scenario.name],
    );
  }
});
