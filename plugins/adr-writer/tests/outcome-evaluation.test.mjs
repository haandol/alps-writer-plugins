import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import authoring from "../evals/scenarios/alps-evaluates-outcomes-with-optional-tension.mjs";
import implementation, {
  deterministicScore,
} from "../evals/scenarios/impl-distinguishes-monitoring-from-required-metrics.mjs";
import { scenarioNamesForChangedPaths } from "../evals/impact-map.mjs";
import validationAuthoring from "../evals/scenarios/alps-evaluates-outcomes-with-validation-contract.mjs";
import validation, {
  deterministicScore as validationScore,
} from "../evals/scenarios/impl-distinguishes-validation-evidence.mjs";

test("validation decisions do not confuse observed failures, unavailable evidence and policy gaps", () => {
  const response = () => ({
    tail: {
      findings: [
        { tag: "A", summary: "REPAIR" },
        { tag: "B", summary: "VERIFY" },
        { tag: "C", summary: "COMPLETE" },
        { tag: "D", summary: "VERIFY" },
        { tag: "E", summary: "DECIDE" },
        { tag: "F", summary: "REASSESS" },
      ],
    },
    events: [],
  });
  assert.ok(validationScore(response()).every((c) => c.pass));
  for (const [index, wrong] of [
    [0, "COMPLETE"],
    [1, "REPAIR"],
    [2, "VERIFY"],
    [3, "COMPLETE"],
    [4, "REPAIR"],
    [5, "COMPLETE"],
  ]) {
    const input = response();
    input.tail.findings[index].summary = wrong;
    assert.ok(validationScore(input).some((c) => !c.pass));
  }
  for (const change of [
    (input) => input.tail.findings.pop(),
    (input) => {
      input.tail.findings[5] = input.tail.findings[0];
    },
    (input) => {
      input.tail.findings[0].summary = "REPAIR; COMPLETE";
    },
    (input) => input.events.push({ kind: "request", tool: "write_file" }),
  ]) {
    const input = response();
    change(input);
    assert.ok(validationScore(input).some((c) => !c.pass));
  }
  assert.ok(validationScore({ tail: { findings: null } }).some((c) => !c.pass));
});

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
  const scenarios = [authoring, implementation, validationAuthoring, validation];
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
  assert.ok(selected.has(validationAuthoring.name));
  assert.ok(selected.has(validation.name));
  const evidenceChanges = scenarioNamesForChangedPaths(
    ["plugins/adr-writer/references/implementation-evidence.md"],
    scenarios,
  );
  assert.ok(evidenceChanges.has(validation.name));
});
