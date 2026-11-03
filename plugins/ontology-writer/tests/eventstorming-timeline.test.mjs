import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { BOARD } from "./eventstorming-fixture.mjs";
import { layoutEventStages } from "../scripts/eventstorming-timeline.mjs";
import {
  eventBoardPage,
  modelEventBoard,
  validateEventBoard,
} from "../scripts/eventstorming-board.mjs";
import { validateModel } from "../scripts/ontology-lib.mjs";

const example = readFileSync(new URL("../templates/ontology/example.ttl", import.meta.url), "utf8");

test("the event story follows cross-context causes while branches stay peers and independent work gains no links", () => {
  const board = structuredClone(BOARD);
  board.stages.push({ ...structuredClone(board.stages[0]), id: "independent" });
  const before = JSON.stringify(board);
  const layout = layoutEventStages(board);
  const position = (id) => layout.stages.find((s) => s.stage.id === id);
  assert.equal(position("submit").column, 0);
  assert.equal(position("pay").column, 1);
  assert.equal(position("reject").column, 1);
  assert.notEqual(position("pay").row, position("reject").row);
  assert.equal(position("confirm").column, 2);
  assert.equal(position("independent").column, 0);
  const html = eventBoardPage(board);
  assert.equal((html.match(/data-story-from=/g) ?? []).length, board.links.length);
  assert.ok(!html.includes('data-story-from="independent"'));
  assert.ok(html.includes("order between unconnected items is unconfirmed"));
  assert.equal(JSON.stringify(board), before);
});

test("returning and self links remain explicit without turning position into an execution timestamp", () => {
  const board = structuredClone(BOARD);
  board.links.push({ ...board.links[0], from: "confirm", to: "submit" });
  board.links.push({ ...board.links[0], from: "pay", to: "pay" });
  const layout = layoutEventStages(board);
  assert.equal(layout.cyclic, true);
  assert.equal(layout.stages.length, board.stages.length);
  assert.ok(layout.stages.every((s) => Number.isFinite(s.column) && Number.isFinite(s.row)));
  const html = eventBoardPage(board);
  assert.ok(html.includes('data-story-from="confirm" data-story-to="submit"'));
  assert.ok(html.includes('data-story-from="pay" data-story-to="pay"'));
  assert.ok(html.includes("Returning links are preserved"));
});

test("model rules and process/step questions retain their source scope without inventing mutations or failure branches", () => {
  const model = validateModel([
    {
      doc: "example.ttl",
      text:
        example +
        '\nm:ordering.confirm-order onto:openScope "What if confirmation is repeated?"^^onto:OpenPath .\n',
    },
  ]);
  assert.equal(model.ok, true);
  const board = modelEventBoard({ index: model.index, mapping: { categories: {} } });
  assert.deepEqual(validateEventBoard(board), []);
  assert.equal(board.questions.filter((q) => q.scopeType === "process").length, 2);
  const question = board.questions.find((q) => q.scopeType === "step");
  assert.equal(question.text, "What if confirmation is repeated?");
  assert.ok(question.stages.every((id) => id.includes("ordering.confirm-order")));
  const confirmation = board.stages.find((s) => s.modelId === "ordering.confirm-order");
  assert.equal(
    confirmation.rules[0].description,
    "The collected amount equals the amount of the order it pays for.",
  );
  assert.equal(confirmation.rules[0].scope, "Related concept: Order");
  assert.ok(
    confirmation.entities.every(
      (e) => e.kind === "concept" && e.before === null && e.after === null,
    ),
  );
  const html = eventBoardPage(board);
  assert.ok(html.includes("not an established failure branch of one event"));
  assert.ok(html.includes("No emitted event is recorded"));
  assert.ok(
    !board.questions.some((q) => q.text.includes("never passes work")),
    "a recorded non-applicable scope is not an open path",
  );
});

test("new rule and question evidence remains inert and unresolved, and invalid scope links fail before rendering", () => {
  const board = structuredClone(BOARD);
  board.stages[0].rules = [
    {
      name: '<img src=x onerror="alert(1)">',
      description: "Rule text",
      scope: "Related concept: Order",
      verdict: "stated",
      evidence: [],
    },
  ];
  board.questions = [
    {
      id: "open",
      text: "</script><script>alert(1)</script>",
      scope: "Ordering",
      scopeType: "process",
      stages: ["submit", "confirm"],
      verdict: "conflicting",
      evidence: board.stages[0].evidence,
    },
  ];
  assert.deepEqual(validateEventBoard(board), []);
  const html = eventBoardPage(board);
  assert.ok(html.includes("&lt;img"));
  assert.ok(!html.includes("<img src=x"));
  assert.ok(!html.includes("</script><script>alert"));
  assert.ok(html.includes("No source location · unconfirmed"));
  assert.ok(html.includes("Conflicting"));
  board.questions[0].stages.push("missing");
  assert.ok(validateEventBoard(board).some((e) => e.includes("existing stage ids")));
  assert.throws(() => eventBoardPage(board));
});
