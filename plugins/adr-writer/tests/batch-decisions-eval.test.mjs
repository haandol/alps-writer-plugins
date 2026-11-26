import { test } from "node:test";
import assert from "node:assert/strict";
import { batchDecisionScenario } from "../evals/lib/batch-decisions.mjs";
import { scenarioNamesForChangedPaths } from "../evals/impact-map.mjs";

test("batch preparation and resumption have distinct obligations kept outside their prompts", () => {
  const [prepare, resume] = [batchDecisionScenario(), batchDecisionScenario(true)];
  assert.notEqual(prepare.obligations[0].text, resume.obligations[0].text);
  for (const scenario of [prepare, resume]) {
    assert.equal(scenario.deterministicScore, undefined);
    for (const rule of scenario.obligations) assert.ok(!scenario.build().includes(rule.text));
  }
});

test("question guidance selects both batch cases without selecting unrelated probes", () => {
  const cases = [batchDecisionScenario(), batchDecisionScenario(true), { name: "hook-unrelated" }];
  const selected = scenarioNamesForChangedPaths(
    ["plugins/adr-writer/references/decision-questions.md"],
    cases,
  );
  assert.deepEqual(
    [...selected].sort(),
    cases
      .slice(0, 2)
      .map((c) => c.name)
      .sort(),
  );
});
