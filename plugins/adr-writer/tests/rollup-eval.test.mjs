import { test } from "node:test";
import assert from "node:assert/strict";
import scenario from "../evals/scenarios/rollup-reconciles-conflicts.mjs";

function answer() {
  return [
    ["adopted", "prepare", 20, "Accepted", ["billing/0003"]],
    ["unadopted", "hold"],
    ["pending", "prepare", 20, "Proposed", ["billing/0003"]],
    ["residual", "hold"],
    ["scopes", "keep"],
    ["cycle", "hold"],
    ["unchanged-approval", "apply", null, null, ["billing/0003"]],
    ["changed-source", "refresh"],
    ["occupied-destination", "refresh"],
    ["partial-approval", "apply", null, null, ["billing/0003"]],
    ["interrupted-apply", "refresh"],
  ].map(([id, action, currentValue = null, status = null, removals = []]) => ({
    id,
    action,
    currentValue,
    status,
    removals,
    renames: [],
    reason: "The provided adoption, scope and source state determine this action.",
    ...(["unchanged-approval", "partial-approval"].includes(id) ? { askRenumber: false } : {}),
    ...(id === "changed-source" ? { continueIndependent: true } : {}),
  }));
}
const score = (rows) => scenario.score({ output: `\`\`\`json\n${JSON.stringify(rows)}\n\`\`\`` });

test("rollup scorer accepts the bounded plan and rejects an absent response", () => {
  assert.ok(score(answer()).every((c) => c.pass));
  assert.ok(scenario.score({ output: "" }).some((c) => !c.pass));
});

for (const [id, patch] of [
  [
    "unadopted",
    { action: "prepare", currentValue: 20, status: "Proposed", removals: ["billing/0003"] },
  ],
  ["pending", { status: "Accepted" }],
  ["residual", { removals: ["storage/0001"] }],
  ["scopes", { action: "hold" }],
  ["cycle", { action: "prepare" }],
  ["unchanged-approval", { askRenumber: true }],
  ["changed-source", { action: "apply" }],
  ["changed-source", { continueIndependent: false }],
  ["occupied-destination", { renames: ["billing/0005:billing/0002"] }],
  ["partial-approval", { removals: ["billing/0003", "storage/0003"] }],
  ["interrupted-apply", { action: "apply", removals: ["billing/0003"] }],
  ["adopted", { action: "hold", reason: "A second alternative is required." }],
]) {
  test(`rollup scorer rejects ${id}: ${JSON.stringify(patch)}`, () => {
    const rows = answer();
    Object.assign(
      rows.find((r) => r.id === id),
      patch,
    );
    assert.ok(score(rows).some((c) => !c.pass && c.label.startsWith(id)));
  });
}

test("a blanket hold cannot pass independent candidates or hide missing snapshots", () => {
  const rows = answer().map((r) => ({ ...r, action: "hold" }));
  assert.ok(score(rows).filter((c) => !c.pass).length >= 4);
  assert.equal(score(answer().slice(1))[0].pass, false);
  const duplicate = answer();
  duplicate[0] = duplicate[1];
  assert.equal(score(duplicate)[0].pass, false);
});
