import { test } from "node:test";
import assert from "node:assert/strict";
import scenario from "../evals/scenarios/sync-prefers-semantic-recency.mjs";
import { scenarioNamesForChangedPaths } from "../evals/impact-map.mjs";

test("recency guidance selects the probe and judge expectations stay outside its prompt", () => {
  assert.ok(
    scenarioNamesForChangedPaths(
      ["plugins/adr-writer/references/decision-reconciliation.md"],
      [scenario],
    ).has(scenario.name),
  );
  for (const obligation of scenario.obligations)
    assert.ok(!scenario.build().includes(obligation.text));
});
