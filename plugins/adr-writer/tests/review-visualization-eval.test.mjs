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
  assert.match(prompt, /Any type supported/);
  assert.match(prompt, /diagramOmissionReason/);
  assert.ok(scenario.score({ tail: { findings: rows } }).every((check) => check.pass));
});

test("type alternatives are left to semantic judgment while malformed records fail", () => {
  const alternative = structuredClone(rows);
  alternative[0].summary =
    "views=sequenceDiagram,stateDiagram-v2; reason=Separate views explain independent relations.";
  alternative[1].summary =
    "views=C4Component,sequenceDiagram; reason=Ownership and order are both covered.";
  alternative[2].summary = "views=stateDiagram-v2; reason=Allowed transitions are the question.";
  assert.ok(scenario.score({ tail: { findings: alternative } }).every((check) => check.pass));
  assert.match(scenario.obligations[0].text, /do not require exact Mermaid type arrays/);
  assert.match(scenario.obligations[0].text, /omission of a material question/);
  const bad = structuredClone(rows);
  bad[0].summary = "views=; reason=Missing selection.";
  bad[1].summary = "views=sequenceDiagram;";
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
