import { test } from "node:test";
import assert from "node:assert/strict";
import scenario, {
  discoveryCases,
  fixtureFiles,
  obligations,
  deterministicScore,
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
const check = (rows, events = []) => deterministicScore({ output: output(rows), events });

test("targeted plans accept clear chains, evidence-driven expansion and unchanged reuse", () => {
  assert.ok(check(answer()).every((c) => c.pass));
  const reordered = answer().reverse();
  for (const row of reordered) {
    row.inspect.reverse();
    row.reuse.reverse();
    row.globalChecks.reverse();
  }
  reordered.find((row) => row.id === "residual-owner").diagram = "none";
  assert.ok(
    check(reordered).every((c) => c.pass),
    "tables can also explain residual ownership",
  );
});

for (const [label, index, mutate] of [
  [
    "whole-system exploration",
    0,
    (r) => r.inspect.push("docs/adr/notifications/0001-delivery.md", "deploy.md"),
  ],
  ["global source audit", 0, (r) => r.inspect.push("src/notifications.mjs")],
  [
    "count-triggered diagram",
    0,
    (r) => {
      r.diagram = "candidate-local";
    },
  ],
  [
    "business map",
    0,
    (r) => {
      r.diagram = "business-context";
    },
  ],
  [
    "event map",
    1,
    (r) => {
      r.diagram = "event-map";
    },
  ],
  [
    "system map",
    1,
    (r) => {
      r.diagram = "whole-system";
    },
  ],
  [
    "missing original",
    0,
    (r) => {
      r.inspect = r.inspect.filter((p) => !p.endsWith("0001-retry-limit.md"));
    },
  ],
  [
    "missing intermediate original",
    0,
    (r) => {
      r.inspect = r.inspect.filter((p) => !p.endsWith("0003-retry-limit.md"));
    },
  ],
  [
    "missing direct neighbor",
    0,
    (r) => {
      r.inspect = r.inspect.filter((p) => !p.endsWith("0002-payment-identity.md"));
    },
  ],
  [
    "missing scoped index",
    0,
    (r) => {
      r.inspect = r.inspect.filter((p) => !p.endsWith(".mapping.json"));
    },
  ],
  [
    "fixed one-hop cutoff",
    1,
    (r) => {
      r.inspect = r.inspect.filter((p) => !p.endsWith("0002-audit-state.md"));
    },
  ],
  [
    "skipped candidate tests",
    1,
    (r) => {
      r.inspect = r.inspect.filter((p) => !p.startsWith("test/"));
    },
  ],
  [
    "invented prior evidence",
    0,
    (r) => {
      r.reuse = r.inspect;
      r.inspect = [];
    },
  ],
  [
    "repeating unchanged discovery",
    2,
    (r) => {
      r.inspect = r.reuse;
      r.reuse = [];
    },
  ],
  [
    "omitted reused original",
    2,
    (r) => {
      r.reuse = r.reuse.filter((p) => !p.endsWith("0003-retry-limit.md"));
    },
  ],
  [
    "unapproved apply",
    0,
    (r) => {
      r.action = "apply";
    },
  ],
  [
    "waived approval",
    0,
    (r) => {
      r.approval = "unnecessary";
    },
  ],
  [
    "survivor-only freshness",
    0,
    (r) => {
      r.freshness = "survivor-only";
    },
  ],
  [
    "reused evidence waives freshness",
    2,
    (r) => {
      r.freshness = "unnecessary";
    },
  ],
  [
    "no-argument silently narrows categories",
    3,
    (r) => {
      r.inspect = r.inspect.filter((p) => !p.includes("/notifications/"));
    },
  ],
  ["no-chain source discovery", 3, (r) => r.inspect.push("src/notifications.mjs")],
]) {
  test(`targeted scorer rejects ${label}`, () => {
    const rows = answer();
    mutate(rows[index]);
    assert.ok(check(rows).some((c) => !c.pass && c.label.startsWith(rows[index].id)));
  });
}

test("every cheap global check stays required even for an unchanged candidate", () => {
  for (const name of ["index", "links", "cycles", "invariants"]) {
    const rows = answer();
    rows[2].globalChecks = rows[2].globalChecks.filter((check) => check !== name);
    assert.ok(check(rows).some((c) => !c.pass));
  }
});

test("missing, extra, duplicate and malformed records cannot look complete", () => {
  for (const mutate of [
    (rows) => rows.pop(),
    (rows) => rows.push(rows[0]),
    (rows) => rows.push({ ...rows[0], id: "unrequested" }),
    (rows) => {
      rows[1] = rows[0];
    },
    (rows) => {
      rows[0].inspect.push(rows[0].inspect[0]);
    },
    (rows) => {
      rows[0].inspect = null;
    },
    (rows) => {
      rows[0].reason = " ";
    },
  ]) {
    const rows = answer();
    mutate(rows);
    assert.ok(check(rows).some((c) => !c.pass));
  }
  for (const text of [
    "",
    "```json\n{}\n```",
    "```json\n[\n```",
    `${output(answer())}\n${output(answer())}`,
  ])
    assert.ok(scenario.score({ output: text }).some((c) => !c.pass));
  for (const tool of ["read_file", "write_file", "run_check"])
    assert.ok(check(answer(), [{ kind: "request", tool, arguments: {} }]).some((c) => !c.pass));
});

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

test("the catalog retains both mechanical guards and semantic obligations", async () => {
  const entry = (await catalog()).find((item) => item.id === scenario.name);
  assert.equal(entry.score, deterministicScore);
  assert.equal(entry.supplementalChecks, true);
  assert.deepEqual(entry.semanticObligations, obligations);
  assert.ok(entry.score({ output: output(answer()), events: [] }).every((c) => c.pass));

  // Correct path records cannot prove prose meaning. Preserve contradictory
  // prose and raw originals for the separate semantic judge, with no SDK call.
  const reply = `First I will map every business context and deployable. I will keep only the newest retry limit and omit payment identity.\n${output(answer())}`;
  assert.ok(scenario.score({ output: reply }).every((c) => c.pass));
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
    "plugins/adr-writer/references/review-report-writing.md",
    "plugins/adr-writer/evals/scenarios/rollup-targeted-discovery.mjs",
  ]) {
    assert.deepEqual(
      [...scenarioNamesForChangedPaths([path], [scenario, { name: "hook-admission-routing" }])],
      [scenario.name],
    );
  }
});
