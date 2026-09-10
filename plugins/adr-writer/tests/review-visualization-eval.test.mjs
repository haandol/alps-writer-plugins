import { test } from "node:test";
import assert from "node:assert/strict";
import scenario from "../evals/scenarios/impl-review-selects-useful-views.mjs";

const rows = [
  {
    tag: "A",
    summary: "views=sequenceDiagram; reason=The failure branch explains the pending outcome.",
  },
  {
    tag: "B",
    summary:
      "views=flowchart,sequenceDiagram; reason=Ownership and ordering are independent questions.",
  },
  { tag: "C", summary: "views=stateDiagram-v2; reason=Allowed transitions are the question." },
  {
    tag: "D",
    summary:
      "views=none; reason=One variable name changes.; omission=No caller, result, or control flow changes.",
  },
];

test("the view-selection eval uses the shipped guide and accepts useful views", () => {
  const prompt = scenario.build();
  assert.match(prompt, /State diagrams are for a lifecycle/);
  assert.match(prompt, /diagramOmissionReason/);
  assert.ok(scenario.score({ tail: { findings: rows } }).every((check) => check.pass));
});

test("the view-selection scorer catches state overuse, missing structure, and ungrounded omission", () => {
  const bad = structuredClone(rows);
  bad[0].summary = "views=sequenceDiagram,stateDiagram-v2; reason=A pending value exists.";
  bad[1].summary = "views=sequenceDiagram; reason=Calls are enough.";
  bad[3].summary = "views=none; reason=Keep the report short.";
  const results = scenario.score({ tail: { findings: bad } });
  assert.equal(results[0].pass, false);
  assert.equal(results[1].pass, false);
  assert.equal(results[2].pass, true);
  assert.equal(results[3].pass, false);
});
