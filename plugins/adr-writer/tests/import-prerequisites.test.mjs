import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { importPrerequisiteCases } from "../evals/skills/import-prerequisites.mjs";
import { catalog } from "../evals/skills/catalog.mjs";
import { makeTools } from "../evals/regression/workspace.mjs";
import { runCase } from "../evals/regression/run.mjs";
import { hasCycle, validateMappingShape } from "../scripts/adr-lint-lib.mjs";
import { PLUGIN_ROOT } from "./helpers.mjs";

const DATE = "2026-10-01";
const INDEX = "docs/adr/.mapping.json";
const [cross, within, projection] = importPrerequisiteCases;
const contractClauses = {
  reserve:
    "Reservation grants only positive integer units no greater than available stock; rejection leaves stock unchanged.",
  confirm:
    "Order confirmation requires a granted reservation for the requested units; rejected reservation creates no confirmed order.",
  cancel:
    "Only confirmed orders can become cancelled; cancellation preserves the reserved units and rejects other states.",
  release: "Stock release requires a cancelled order; other states leave stock unchanged.",
  lookup:
    "Support lookup returns an order only to its owning member; other members receive no result.",
};

// Authored positive documents are independent of the verifier implementation.
// Passing these stub traces establishes mechanical compatibility, not a GEval
// result or proof that a live model will discover/describe the same contracts.
function document(decision) {
  const clauses = [contractClauses[decision.id]];
  if (decision.id === "confirm")
    clauses.push(
      "Prerequisite owner: Stock reservation.",
      `Required guarantee: ${contractClauses.reserve}`,
    );
  if (decision.id === "release")
    clauses.push(
      "Prerequisite owner: Order cancellation.",
      `Required guarantee: ${contractClauses.cancel}`,
    );
  return `# ADR ${decision.path.split("/").at(-1).slice(0, 4)}: ${decision.title}

Date: ${DATE}

## Status

Proposed

## Purpose

Keep the confirmed shop behavior and its owning business rule readable independently of source. The current reason is to preserve valid stock transitions and member visibility; original adoption history is unknown.

## Decision Drivers

- Prevent confirmation of unavailable units.
- Preserve rejection without changing stock.
- Retain the approved ownership and visibility boundaries.

## Decision

Retain ${decision.title} with the confirmed behavior below. Its required guarantees remain explicit even when another decision owns them.

### Requirement contract

${clauses.map((clause) => `- ${clause}`).join("\n")}

#### Observable evidence

${decision.id === "lookup" ? "Given an order owned by one member, that member sees it and a different member receives no result." : "Given three available units, requesting four units rejects without changing stock; requesting two can reserve and confirm two units."}

### Alternatives

1. Retain the confirmed behavior and current reason so users can rely on the stated outcomes.
2. Change the contract only through a separate policy decision; rejection and visibility outcomes would need new approval.

## Consequences

The current contract remains explicit. Original motives remain unknown rather than invented.
`;
}

function mappingFor(
  item,
  decisions = item.decisions.filter((d) => item.approvedIds.includes(d.id)),
) {
  const categories = {};
  for (const d of decisions) {
    categories[d.category] ??= { feature: d.category, adrs: [], dependsOn: [] };
    categories[d.category].adrs.push({ path: d.path, status: "Proposed", summary: d.title });
  }
  // These expected edges are authored explicitly, not derived by the verifier.
  if (item === cross) categories.ordering.dependsOn = ["inventory"];
  return { categories };
}

function report(item) {
  return `# Synthetic shop import

## Workflow evidence

A member requests units. Stock reservation rejects nonpositive, fractional or unavailable units without mutation; successful reservation enables order confirmation. The local policy tests exercise both paths.

## Business boundaries

One process runs packages in one repository. Confirmed business ownership comes from README, not the package layout.

## Decision candidates

${item.decisions.map((d) => `${d.id}: ${d.title} — ${contractClauses[d.id]}`).join("\n")}

## Contract prerequisites

Arrows mean dependent requires owner. Confirmation needs the stock guarantee, not just the fact that a function was called.
confirm requires reserve: ${contractClauses.reserve}
${
  item === projection
    ? `release requires cancel: ${contractClauses.cancel}

The decision graph has two independent edges and no cycle. Their projection creates ordering -> inventory and inventory -> ordering, a category cycle that also overstates other decisions' prerequisites. reserve, confirm, cancel and release remain pending. Clarify decision ownership or grouping before applying them; dropping an edge would lose a confirmed guarantee. lookup proceeds independently because member visibility does not require either stock guarantee.
`
    : item === within
      ? "Reservation and confirmation remain distinct decisions inside ordering. Preserve their guarantee and owner in the dependent ADR; do not add a self-edge.\n"
      : "ordering requires inventory. Persist the guarantee and owner in confirmation as well as the category dependency.\n"
}`;
}

async function execute(item, mutant, { guidance = true, finalChecks = false } = {}) {
  const folder = mkdtempSync(path.join(tmpdir(), "import-prerequisites-"));
  try {
    const result = await runCase(
      item,
      { name: "candidate", root: PLUGIN_ROOT, hash: "local", guidance },
      1,
      folder,
      {
        timeout: 10,
        referenceDate: DATE,
        "capture-only": true,
        invoke: async ({ cwd, config }) => {
          const [, root, pluginRoot, logPath, rawTurn, rawGuidance, checkerRoot, rawArtifacts] =
            JSON.parse(readFileSync(config, "utf8")).mcpServers.fixture.args;
          assert.equal(root, cwd);
          assert.equal(rawGuidance !== "off", guidance);
          const turn = Number(rawTurn);
          const tools = makeTools({
            root,
            pluginRoot,
            logPath,
            turn,
            guidance,
            checkerRoot,
            artifactPaths: JSON.parse(rawArtifacts),
          });
          const write = (file, content) => tools.call("write_file", { path: file, content });
          let reportBody = report(item);
          if (mutant === "hidden-report-edge" && turn >= 2)
            reportBody = reportBody
              .split("\n")
              .filter((line) => !line.startsWith("release requires cancel:"))
              .join("\n");
          write(item.artifactPaths[0], reportBody);
          if (turn === 1) {
            for (const file of Object.keys(item.build())) tools.call("read_file", { path: file });
            if (mutant === "early-restored") {
              write(item.decisions[0].path, document(item.decisions[0]));
              tools.call("delete_file", { path: item.decisions[0].path });
            }
          } else if (turn === 2) {
            const approved = item.decisions.filter((d) => item.approvedIds.includes(d.id));
            for (const d of approved) {
              let body = document(d);
              if (d.id === "confirm") {
                if (mutant === "owner-missing")
                  body = body.replace("- Prerequisite owner: Stock reservation.\n", "");
                if (mutant === "guarantee-missing")
                  body = body.replace(`- Required guarantee: ${contractClauses.reserve}\n`, "");
                if (mutant === "related-only") {
                  body = body
                    .replace("- Prerequisite owner: Stock reservation.\n", "")
                    .replace(`- Required guarantee: ${contractClauses.reserve}\n`, "");
                  body += `\n## Related\n\nPrerequisite owner: Stock reservation.\nRequired guarantee: ${contractClauses.reserve}\n`;
                }
              }
              if (mutant !== "independent-stalled") write(d.path, body);
            }
            const mapping = mappingFor(item);
            if (mutant === "edge-dropped") mapping.categories.ordering.dependsOn = [];
            if (mutant === "self-edge") mapping.categories.ordering.dependsOn = ["ordering"];
            if (mutant === "schema-record")
              mapping.categories.ordering.adrs[0].dependsOn = [item.decisions[0].path];
            if (mutant === "schema-category")
              mapping.categories.ordering.decisionEdges = [{ from: "confirm", to: "reserve" }];
            if (mutant === "schema-top") mapping.decisionDependencies = item.edges;
            if (mutant !== "independent-stalled") write(INDEX, JSON.stringify(mapping));

            if (mutant === "pending-restored") {
              const pending = item.decisions.find((d) => d.id === "reserve");
              write(pending.path, document(pending));
              tools.call("delete_file", { path: pending.path });
            }
            if (mutant === "pending-index-restored") {
              const changed = mappingFor(item, item.decisions);
              write(INDEX, JSON.stringify(changed));
              write(INDEX, JSON.stringify(mapping));
            }
            if (mutant === "hidden-drop-and-apply") {
              // The omitted projected edge makes this bad mapping acyclic, but
              // does not authorize applying any of the four pending decisions.
              for (const d of item.decisions.filter((d) => d.id !== "lookup"))
                write(d.path, document(d));
              const changed = mappingFor(item, item.decisions);
              changed.categories.ordering.dependsOn = ["inventory"];
              write(INDEX, JSON.stringify(changed));
            }
            if (mutant === "placeholder" || mutant === "placeholder-restored") {
              const file = "docs/adr/common/0001-placeholder.md";
              write(
                file,
                document({
                  ...item.decisions[0],
                  path: file,
                  title: "Shared guarantee placeholder",
                }),
              );
              const changed = structuredClone(mapping);
              changed.categories.common = {
                feature: "Common",
                adrs: [{ path: file, status: "Proposed", summary: "Synthetic owner" }],
                dependsOn: [],
              };
              write(INDEX, JSON.stringify(changed));
              if (mutant === "placeholder-restored") {
                tools.call("delete_file", { path: file });
                write(INDEX, JSON.stringify(mapping));
              }
            }
            if (mutant === "schema-restored") {
              write(INDEX, JSON.stringify({ ...mapping, decisionDependencies: item.edges }));
              write(INDEX, JSON.stringify(mapping));
            }
          } else if (mutant === "repeat-write") {
            write(INDEX, tools.call("read_file", { path: INDEX }));
          }
          if (finalChecks && turn === 3) {
            for (const kind of ["structure", "invariants", "policy-tests"]) {
              const check = tools.call("run_check", { kind });
              assert.equal(check.exitCode, 0, `${kind}: ${check.stdout}${check.stderr}`);
            }
          }
          return {
            text:
              turn === 1
                ? "Prepared the four discovery views and contract questions."
                : item === projection
                  ? "lookup adopted; reserve, confirm, cancel and release pending due to category projection."
                  : "Approved decisions adopted as Proposed; repeat leaves official files unchanged.",
            models: ["stub"],
            ms: 1,
            costUSD: 0,
          };
        },
      },
    );
    assert.equal(result.verdict, "UNSCORED", result.error);
    const evidence = JSON.parse(
      readFileSync(path.join(folder, result.artifactDirectory, "evidence.json"), "utf8"),
    );
    return { evidence, checks: item.verifyEvidence(evidence) };
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

test("all three prerequisite cases are discoverable execution cases with separate semantic obligations", async () => {
  const entries = await catalog();
  for (const item of importPrerequisiteCases) {
    const registered = entries.filter((c) => c.id === item.id);
    assert.equal(registered.length, 1);
    assert.equal(registered[0].type, "execution");
    assert.equal(registered[0].verifyEvidence, item.verifyEvidence);
    assert.deepEqual(registered[0].obligations, item.obligations);
    assert.ok(item.obligations.some((o) => o.id === "prerequisite-meaning"));
    assert.ok(item.obligations.some((o) => o.id === "projection-and-ownership"));
  }
});

test("positive fixture-tool traces preserve cross-category edges, same-category prose and independent progress", async (t) => {
  for (const item of importPrerequisiteCases)
    await t.test(item.id, async () => {
      const { checks, evidence } = await execute(item, undefined, { finalChecks: true });
      assert.ok(
        checks.every((c) => c.pass),
        JSON.stringify(checks),
      );
      const applied = evidence.checkpoints[1].files;
      assert.deepEqual(applied, evidence.checkpoints[2].files);
      const mapping = JSON.parse(applied[INDEX]);
      assert.deepEqual(mapping, mappingFor(item));
      if (item === projection) {
        assert.deepEqual(Object.keys(mapping.categories), ["support"]);
        assert.ok(applied["docs/adr/support/0001-lookup.md"]);
        assert.ok(
          item.decisions.filter((d) => d.id !== "lookup").every((d) => !(d.path in applied)),
        );
      }
    });
});

test("same fixture tools and verifier also accept a guidance-withheld execution", async () => {
  const { checks } = await execute(cross, undefined, { guidance: false });
  assert.ok(
    checks.every((c) => c.pass),
    JSON.stringify(checks),
  );
});

test("projection fixture has an acyclic decision graph but cyclic category projection", () => {
  assert.deepEqual(
    projection.edges.map(({ dependent, owner }) => [dependent, owner]),
    [
      ["confirm", "reserve"],
      ["release", "cancel"],
    ],
  );
  // In-memory adapter to the existing graph oracle, never a persisted schema.
  const decisionGraph = {
    categories: Object.fromEntries(
      projection.decisions.map((d) => [
        d.id,
        { dependsOn: projection.edges.filter((e) => e.dependent === d.id).map((e) => e.owner) },
      ]),
    ),
  };
  assert.equal(hasCycle(decisionGraph), false);
  const projected = mappingFor(projection, projection.decisions);
  projected.categories.ordering.dependsOn = ["inventory"];
  projected.categories.inventory.dependsOn = ["ordering"];
  assert.equal(hasCycle(projected), true);
  assert.ok(validateMappingShape(projected).some((i) => i.code === "dependson-cycle"));
  assert.deepEqual(projected.categories.support.dependsOn, []);
});

test("verifier rejects dropped edges, lost owner/guarantee, Related-only contracts and schema changes", async (t) => {
  const cases = [
    [cross, "edge-dropped", "approved index"],
    [within, "self-edge", "approved index"],
    ...[cross, within].flatMap((item) =>
      ["owner-missing", "guarantee-missing", "related-only"].map((mutant) => [
        item,
        mutant,
        "dependent ADRs",
      ]),
    ),
    ...["schema-record", "schema-category", "schema-top"].map((mutant) => [
      cross,
      mutant,
      "approved index",
    ]),
    [cross, "schema-restored", "every official write"],
  ];
  for (const [item, mutant, label] of cases)
    await t.test(`${item.id}: ${mutant}`, async () => {
      const { checks } = await execute(item, mutant);
      assert.ok(
        checks.some((c) => c.label.startsWith(label) && !c.pass),
        JSON.stringify(checks),
      );
    });
});

test("projection rejects hidden drops, synthetic owners and pending writes even after restoration", async (t) => {
  for (const [mutant, label] of [
    ["pending-restored", "only independent"],
    ["pending-index-restored", "every official write"],
    ["hidden-drop-and-apply", "only independent"],
    ["hidden-report-edge", "required decision edges"],
    ["placeholder", "no hidden official"],
    ["placeholder-restored", "only independent"],
    ["independent-stalled", "approved index"],
  ])
    await t.test(mutant, async () => {
      const { checks, evidence } = await execute(projection, mutant);
      assert.ok(
        checks.some((c) => c.label.startsWith(label) && !c.pass),
        JSON.stringify(checks),
      );
      if (mutant === "hidden-drop-and-apply") {
        // Ordinary schema/DAG validity cannot detect an omitted required edge.
        const mapping = JSON.parse(evidence.after[INDEX]);
        assert.equal(hasCycle(mapping), false);
        assert.ok(!validateMappingShape(mapping).some((issue) => issue.level === "error"));
      }
      if (mutant.endsWith("restored")) {
        assert.deepEqual(JSON.parse(evidence.after[INDEX]), mappingFor(projection));
        assert.ok(
          projection.decisions
            .filter((d) => d.id !== "lookup")
            .every((d) => !(d.path in evidence.after)),
        );
      }
    });
});

test("approval timing and no-op event guards survive restoration and incomplete evidence", async () => {
  for (const mutant of ["early-restored", "repeat-write"]) {
    const { checks } = await execute(cross, mutant);
    assert.ok(
      checks.some((c) => !c.pass),
      mutant,
    );
  }
  const { evidence } = await execute(cross);
  const incomplete = structuredClone(evidence);
  incomplete.checkpoints.pop();
  assert.ok(cross.verifyEvidence(incomplete).some((c) => !c.pass));
  const modifiedSource = structuredClone(evidence);
  modifiedSource.checkpoints[1].files["packages/stock/reserve.mjs"] = "changed then restored";
  assert.equal(
    cross.verifyEvidence(modifiedSource).find((c) => c.label.startsWith("original inputs")).pass,
    false,
  );
});
