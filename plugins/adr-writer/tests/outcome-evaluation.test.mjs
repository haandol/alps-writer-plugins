import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import authoring from "../evals/scenarios/alps-evaluates-outcomes-with-optional-tension.mjs";
import implementation, {
  deterministicScore,
} from "../evals/scenarios/impl-distinguishes-monitoring-from-required-metrics.mjs";
import { scenarioNamesForChangedPaths } from "../evals/impact-map.mjs";

const response = () => ({
  tail: {
    findings: [
      { tag: "A", summary: "PROCEED" },
      { tag: "B", summary: "PROCEED" },
      { tag: "C", summary: "REJECT" },
      { tag: "D", summary: "NOT_PROVEN" },
    ],
  },
  events: [],
});

test("metric decision checks distinguish optional signals, required failures and incomparable evidence", () => {
  assert.ok(deterministicScore(response()).every((c) => c.pass));
  for (const [i, wrong] of [
    [0, "REJECT"],
    [1, "REJECT"],
    [2, "PROCEED"],
    [3, "PROCEED"],
  ]) {
    const input = response();
    input.tail.findings[i].summary = wrong;
    assert.ok(deterministicScore(input).some((c) => !c.pass));
  }
  const duplicate = response();
  duplicate.tail.findings[3] = duplicate.tail.findings[0];
  assert.ok(deterministicScore(duplicate).some((c) => !c.pass));
  const action = response();
  action.events.push({ kind: "request", tool: "write_file" });
  assert.ok(deterministicScore(action).some((c) => !c.pass));
});

test("outcome probes use shipping guidance, keep judge obligations private and respond to guidance changes", () => {
  const guide = readFileSync(
    new URL("../references/outcome-evaluation.md", import.meta.url),
    "utf8",
  );
  for (const scenario of [authoring, implementation]) {
    assert.ok(scenario.build().includes(guide));
    for (const obligation of scenario.obligations)
      assert.ok(!scenario.build().includes(obligation.text));
  }
  const selected = scenarioNamesForChangedPaths(
    ["plugins/adr-writer/references/outcome-evaluation.md"],
    [authoring, implementation],
  );
  assert.ok(selected.has(implementation.name));
  assert.ok(selected.has(authoring.name));
});
