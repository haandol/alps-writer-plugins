import { test } from "node:test";
import assert from "node:assert/strict";
import { featureBoundaryScenario } from "../evals/lib/feature-boundaries.mjs";
import { scenarioNamesForChangedPaths } from "../evals/impact-map.mjs";

test("every boundary probe keeps its judge obligations outside the prompt", () => {
  for (const product of [false, true, "lite", "handoff"]) {
    const scenario = featureBoundaryScenario(product);
    assert.equal(scenario.deterministicScore, undefined);
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

test("handoff supplies confirmed, missing and conflicting boundaries without their answers", () => {
  const prompt = featureBoundaryScenario("handoff").build();
  for (const id of ["E", "F", "G"]) assert.match(prompt, new RegExp(`^${id}: `, "m"));
  assert.doesNotMatch(prompt, /Propose a grounded grouping/);
  assert.doesNotMatch(prompt, /must remain unresolved/);
  assert.doesNotMatch(prompt, /propose missing boundaries and ask about material conflicts/);
});
