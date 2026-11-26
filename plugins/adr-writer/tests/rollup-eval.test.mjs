import { test } from "node:test";
import assert from "node:assert/strict";
import scenario from "../evals/scenarios/rollup-reconciles-conflicts.mjs";

const probeIds = [
  "adopted",
  "unadopted",
  "pending",
  "residual",
  "scopes",
  "cycle",
  "unchanged-approval",
  "changed-source",
  "occupied-destination",
  "partial-approval",
  "interrupted-apply",
];

test("every rollup snapshot is shown to the target and judged by its own obligation", () => {
  const prompt = scenario.build();
  for (const id of probeIds) assert.match(prompt, new RegExp(`"id": "${id}"`));
  assert.deepEqual(
    scenario.obligations.map((obligation) => obligation.id),
    ["coverage", ...probeIds],
  );
  assert.equal(scenario.score, undefined);
});

test("rollup judge expectations stay outside the target prompt", () => {
  const prompt = scenario.build();
  for (const obligation of scenario.obligations)
    assert.ok(!prompt.includes(obligation.text), obligation.id);
  assert.doesNotMatch(prompt, /"expected"/);
});
