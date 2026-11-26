import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import authoring from "../evals/scenarios/alps-evaluates-outcomes-with-optional-tension.mjs";
import kpiTension from "../evals/scenarios/alps-evaluates-outcomes-kpi-tension.mjs";
import implementation from "../evals/scenarios/impl-distinguishes-monitoring-from-required-metrics.mjs";
import { scenarioNamesForChangedPaths } from "../evals/impact-map.mjs";
import validationAuthoring from "../evals/scenarios/alps-evaluates-outcomes-with-validation-contract.mjs";
import validation from "../evals/scenarios/impl-distinguishes-validation-evidence.mjs";

test("outcome probes use shipping guidance, keep judge obligations private and respond to guidance changes", () => {
  const guide = readFileSync(
    new URL("../references/outcome-evaluation.md", import.meta.url),
    "utf8",
  );
  const scenarios = [authoring, kpiTension, implementation, validationAuthoring, validation];
  for (const scenario of scenarios) {
    assert.ok(scenario.build().includes(guide));
    for (const obligation of scenario.obligations)
      assert.ok(!scenario.build().includes(obligation.text));
  }
  const selected = scenarioNamesForChangedPaths(
    ["plugins/adr-writer/references/outcome-evaluation.md"],
    scenarios,
  );
  assert.ok(selected.has(implementation.name));
  assert.ok(selected.has(authoring.name));
  assert.ok(selected.has(kpiTension.name));
  assert.ok(selected.has(validationAuthoring.name));
  assert.ok(selected.has(validation.name));
  const evidenceChanges = scenarioNamesForChangedPaths(
    ["plugins/adr-writer/references/implementation-evidence.md"],
    scenarios,
  );
  assert.ok(evidenceChanges.has(validation.name));
});
