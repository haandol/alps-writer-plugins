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
  {
    tag: "E",
    summary:
      "views=none; reason=Respect prose-only delivery.; omission=The user excludes figures for this complex review.",
  },
  {
    tag: "F",
    summary:
      "views=none; reason=Deliver the known responsibilities in prose.; omission=Call evidence is absent and the channel is plain text only.",
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

test("complex figure exclusions and unavailable evidence cannot be replaced by forced diagrams", () => {
  const bad = structuredClone(rows);
  bad[4].summary = "views=sequenceDiagram; reason=Complex reviews require a diagram.";
  bad[5].summary = "views=flowchart; reason=Guess missing calls to finish a top-down view.";
  const results = scenario.score({ tail: { findings: bad } });
  assert.equal(results[4].pass, false);
  assert.equal(results[5].pass, false);
  assert.equal(scenario.score({ tail: { findings: rows.slice(0, 4) } })[4].pass, false);
});
