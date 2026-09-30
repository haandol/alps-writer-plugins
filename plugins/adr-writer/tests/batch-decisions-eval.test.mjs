import { test } from "node:test";
import assert from "node:assert/strict";
import { batchDecisionScenario } from "../evals/lib/batch-decisions.mjs";
import { scenarioNamesForChangedPaths } from "../evals/impact-map.mjs";

const response = (summaries) => ({
  events: [],
  tail: { findings: summaries.map((summary, i) => ({ tag: "ABC"[i], summary })) },
});

test("batch preparation and resumption have distinct obligations and reject wrong actions", () => {
  for (const [resume, choices] of [
    [false, ["READY", "ASK_INTENT", "ASK_CONFLICT"]],
    [true, ["CONTINUE", "APPLY", "DEFER"]],
    [true, ["APPLY", "APPLY", "DEFER"]],
  ]) {
    const scenario = batchDecisionScenario(resume);
    assert.ok(scenario.deterministicScore(response(choices)).every((c) => c.pass));
    for (let i = 0; i < 3; i++) {
      const bad = [...choices];
      bad[i] = "APPROVE_ALL";
      assert.ok(scenario.deterministicScore(response(bad)).some((c) => !c.pass));
    }
    const duplicate = response(choices);
    duplicate.tail.findings.push(duplicate.tail.findings[0]);
    assert.ok(scenario.deterministicScore(duplicate).some((c) => !c.pass));
    const writes = response(choices);
    writes.events.push({ kind: "request", tool: "write_file", arguments: { path: "contract.md" } });
    assert.ok(scenario.deterministicScore(writes).some((c) => !c.pass));
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
