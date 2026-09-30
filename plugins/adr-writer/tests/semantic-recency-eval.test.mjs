import { test } from "node:test";
import assert from "node:assert/strict";
import scenario, { deterministicScore } from "../evals/scenarios/sync-prefers-semantic-recency.mjs";
import { scenarioNamesForChangedPaths } from "../evals/impact-map.mjs";

const response = () => ({
  events: [],
  tail: {
    findings: Object.entries({
      A: "KEEP_30",
      B: "KEEP_30",
      C: "ASK_50",
      D: "ASK_ORDER",
      E: "KEEP_20",
      F: "KEEP_BOTH",
    }).map(([tag, summary]) => ({ tag, summary })),
  },
});

test("the recency scorer rejects timestamp wins, inferred approval, and scope collapse", () => {
  assert.ok(deterministicScore(response()).every((r) => r.pass));
  for (const [index, wrong] of [
    [0, "KEEP_20"],
    [1, "KEEP_20"],
    [2, "KEEP_30"],
    [3, "KEEP_30"],
    [4, "KEEP_30"],
    [5, "KEEP_30"],
  ]) {
    const result = response();
    result.tail.findings[index].summary = wrong;
    assert.ok(deterministicScore(result).some((r) => !r.pass));
  }
});

test("duplicate, missing, extra records and hidden writes cannot pass the recency probe", () => {
  for (const mutate of [
    (r) => r.tail.findings.pop(),
    (r) => r.tail.findings.push(r.tail.findings[0]),
    (r) => r.events.push({ kind: "request", tool: "write_file", arguments: { path: "policy.md" } }),
  ]) {
    const result = response();
    mutate(result);
    assert.ok(deterministicScore(result).some((r) => !r.pass));
  }
});

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
