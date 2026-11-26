import { test } from "node:test";
import assert from "node:assert/strict";
import scenario from "../evals/scenarios/impl-review-selects-useful-views.mjs";

test("the view-selection eval uses the shipped guide", () => {
  const prompt = scenario.build();
  assert.match(prompt, /Any type supported/);
  assert.match(prompt, /diagramOmissionReason/);
  for (const obligation of scenario.obligations) assert.ok(!prompt.includes(obligation.text));
});

test("type alternatives and omission grounds are left to semantic judgment", () => {
  assert.match(scenario.obligations[0].text, /do not require exact Mermaid type arrays/);
  assert.match(scenario.obligations[0].text, /omission of a material question/);
  assert.match(scenario.obligations[1].text, /E must honor the user's diagram exclusion/);
  assert.equal(scenario.score, undefined);
});
