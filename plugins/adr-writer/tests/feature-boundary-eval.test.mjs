import { test } from "node:test";
import assert from "node:assert/strict";
import { featureBoundaryScenario } from "../evals/lib/feature-boundaries.mjs";
import { scenarioNamesForChangedPaths } from "../evals/impact-map.mjs";

test("both authoring probes reject service-count, layer, UI and scope substitutions", () => {
  for (const product of [false, true, "lite"]) {
    const scenario = featureBoundaryScenario(product);
    const good = () => ({
      events: [],
      tail: {
        findings: ["TWO_CONTEXTS", "TWO_CONTEXTS", "HEADLESS", "PARTIAL"].map((summary, i) => ({
          tag: "ABCD"[i],
          summary,
        })),
      },
    });
    assert.ok(scenario.deterministicScore(good()).every((c) => c.pass));
    const explained = good();
    for (const row of explained.tail.findings) row.summary += " — supplied evidence";
    assert.ok(scenario.deterministicScore(explained).every((c) => c.pass));
    for (const [index, summary] of [
      [0, "THREE_CONTEXTS"],
      [1, "LAYER_GROUPS"],
      [2, "ADD_SCREEN"],
      [3, "COMPLETE"],
    ]) {
      const bad = good();
      bad.tail.findings[index].summary = summary;
      assert.ok(scenario.deterministicScore(bad).some((c) => !c.pass));
    }
    const duplicate = good();
    duplicate.tail.findings[0] = duplicate.tail.findings[1];
    assert.ok(scenario.deterministicScore(duplicate).some((c) => !c.pass));
    for (const obligation of scenario.obligations)
      assert.ok(!scenario.build().includes(obligation.text));
  }
});

test("either installed copy of the boundary guidance selects both authoring probes", () => {
  const cases = [featureBoundaryScenario(), featureBoundaryScenario(true)];
  for (const plugin of ["alps-writer", "adr-writer"]) {
    const selected = scenarioNamesForChangedPaths(
      [`plugins/${plugin}/references/feature-boundaries.md`],
      cases,
    );
    assert.equal(selected.size, 2);
  }
});

test("handoff distinguishes confirmed, missing and conflicting business boundaries", () => {
  const scenario = featureBoundaryScenario("handoff");
  const response = () => ({
    events: [],
    tail: {
      findings: [
        "TWO_CONTEXTS",
        "TWO_CONTEXTS",
        "HEADLESS",
        "PARTIAL",
        "REUSE",
        "PROPOSE",
        "ASK_BOUNDARY",
      ].map((summary, i) => ({ tag: "ABCDEFG"[i], summary })),
    },
  });
  assert.ok(scenario.deterministicScore(response()).every((c) => c.pass));
  for (const [index, wrong] of [
    [4, "ASK_BOUNDARY"],
    [5, "REUSE"],
    [6, "REUSE"],
  ]) {
    const bad = response();
    bad.tail.findings[index].summary = wrong;
    assert.ok(scenario.deterministicScore(bad).some((c) => !c.pass));
  }
});
